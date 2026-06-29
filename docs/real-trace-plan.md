# 用真实环境 trace 驱动 GPU Explainer（MoE 推理 · SGLang · 单机多卡）

目标：在 AWS 单机多卡上用 SGLang 部署一个 MoE 模型，采集**真实推理 trace**，
把实测数据映射进可视化页面，替换当前的示意数据。

---

## 0. 一个关键认知：MoE 推理的跨卡通信 ≠ 训练的 Ring All-Reduce

当前页面（v0.7）画的是**训练**的梯度 Ring All-Reduce。MoE **推理**的跨卡通信是另外两种：

- **张量并行 TP**：每层算子（attention / MLP）算完做一次 **All-Reduce** 合并分片结果。
- **专家并行 EP（MoE 灵魂）**：router 给 token 选中 top-k 专家后，用 **all-to-all**
  把 token 分发到持有该专家的 GPU，算完再 all-to-all 收回。这是动态、不规则的通信。

> 接真实数据后，可视化应从「ring 梯度同步」改为推理循环：
> **每层： 本地计算 → (TP) All-Reduce / (EP) all-to-all → 下一层**。

---

## 1. 机型与模型

### 机型（AWS）
| 机型 | GPU | 互联 | 备注 |
|---|---|---|---|
| **p4d.24xlarge**（推荐） | 8× A100 40GB | NVSwitch 全互联 | 有真正的 NVLink，能展示卡间高带宽 |
| p4de.24xlarge | 8× A100 80GB | NVSwitch | 显存更大，能跑更大模型 |
| p5.48xlarge | 8× H100 80GB | NVSwitch | 最强但贵、配额难申请 |
| ⚠️ g5/g6e | A10G/L40S | **PCIe**（无 NVLink） | 不要用来演示 NVLink |

### 模型（MoE）
| 模型 | 规模 | 起步卡数 | 用途 |
|---|---|---|---|
| **Mixtral 8x7B**（推荐正式素材） | 47B · 8 专家 top-2 | tp=8 @ p4d | 经典、文档多、专家结构讲解清晰 |
| Qwen3-30B-A3B | 30B MoE | 2–4 卡 | 更现代、更省 |
| DeepSeek-V2-Lite | 16B MoE | 2 卡 | **先跑通流程的最省选择** |

建议：先用 **DeepSeek-V2-Lite @ 2 卡**把采集+转换+页面跑通，再上 Mixtral 做正式素材。

---

## 2. 部署 + 采集（SGLang 内置 torch profiler）

SGLang 内置 torch profiler，并能自动**合并多卡（TP/DP/PP/EP）分布式 trace**。

```bash
# 1) 设输出目录并启动 MoE 服务（8 卡张量并行 + 专家并行）
export SGLANG_TORCH_PROFILER_DIR=/root/sglang/profile_log
# 可选：记录 shape / 调用栈（trace 会变大）
export SGLANG_PROFILE_RECORD_SHAPES=True
python -m sglang.launch_server \
  --model-path mistralai/Mixtral-8x7B-Instruct-v0.1 \
  --tp 8 --ep 8 \
  --host 0.0.0.0 --port 30000

# 2) 开始 profiling（num_steps = 抓多少个 forward），同时发推理请求
curl -X POST -H 'Content-Type: application/json' \
  http://127.0.0.1:30000/start_profile -d '{"num_steps":5}'

curl -X POST http://127.0.0.1:30000/generate \
  -H 'Content-Type: application/json' \
  -d '{"text":"The quick brown fox","sampling_params":{"max_new_tokens":8}}'

# 3) trace 自动写到 SGLANG_TORCH_PROFILER_DIR，格式为 Chrome Trace（*.trace.json.gz）
```

也可以用 CLI：`python -m sglang.profiler --url http://127.0.0.1:30000 --num-steps 5 --profile-by-stage`
（会区分 prefill / decode 两个阶段，对推理可视化很有用）。

---

## 3. 能实测什么 vs 仍是示意

| 页面元素 | torch.profiler（SGLang 内置） | 需 Nsight 额外测 |
|---|---|---|
| 时间轴 / 各 kernel 耗时 / 先后 | ✅ 实测 | — |
| PCIe H2D/D2H 搬运（字节数） | ✅ 实测 | — |
| 跨卡通信（all-reduce / all-to-all） | ✅ 实测（`ncclKernel*` / `nccl*AllToAll*`） | — |
| 专家路由统计（哪些专家被选） | ✅ 可从 EP / EPLB 统计拿 | — |
| SM 占用率 / warp 活跃度（钻取视图） | ❌ | `nsys` / `ncu` |
| NVLink / HBM 真实带宽数字 | ❌ | `nsys` / DCGM |

> 凡是 torch.profiler 给不了的（SM/warp/HBM 带宽），要么补跑 Nsight Systems/Compute，
> 要么在图上明确标注「示意值」，不要伪装成实测。

补充采集（可选，拿芯片内部指标）：
```bash
# 时间轴 + NVLink/NCCL 带宽（系统级）
nsys profile -o infer_nsys --trace=cuda,nvtx,nvlink python your_infer.py
# 单个 kernel 的 SM 占用 / 访存吞吐（kernel 级，开销大）
ncu --set full -o infer_ncu python your_infer.py
```

---

## 4. trace → 页面数据 的映射

Chrome Trace 的 `traceEvents` 每条含：`name`、`cat`、`ts`(µs)、`dur`、`pid/tid`、`args`。
映射规则：

| trace 事件（cat / name 关键字） | 映射到页面 |
|---|---|
| `cpu_op`、`cudaLaunchKernel` | CPU 泳道（下发） |
| `cudaStreamSynchronize` / 长 CPU 空档 | CPU「等待」段 |
| `gpu_memcpy`（HtoD/DtoH） | PCIe 段（字节数 → 包密度） |
| `kernel`：`*gemm*` / `*mm*` | GPU 计算段（GEMM） |
| `kernel`：`*attention*` / `*flash*` | attention 段 |
| `kernel`：`*moe*` / `*expert*` / `*topk*` | MoE 路由 / 专家计算段 |
| `kernel`：`ncclKernel*AllReduce*` | TP 跨卡 All-Reduce 段 |
| `kernel`：`ncclKernel*AllToAll*` / DeepEP | EP 专家 all-to-all 段 |

转换脚本骨架见 `tools/trace_to_steps.py`，输出 `web_data.json`，页面加载它来驱动时间轴。

---

## 5. 落地顺序建议

1. 本地：跑 `tools/trace_to_steps.py` 处理我准备的样例 trace（或你的小模型 trace），生成 `web_data.json`。
2. 改页面：把 v0.7 写死的 `STEPS` 换成从 `web_data.json` 读取（保留同样的数据结构）。
3. AWS：DeepSeek-V2-Lite @ 2 卡跑通 → 换 Mixtral 8x7B 出正式素材。
4. 可选：补 nsys/ncu，把 SM 占用、NVLink 带宽也换成实测。

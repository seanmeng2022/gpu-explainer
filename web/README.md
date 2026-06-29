# 真实数据流可视化页面（web/）

打开 `web/index.html`，按真实推理 trace 逐步回放数据在 CPU/PCIe/GPU/卡间通信上的流动。
> 注意：浏览器对 `file://` 动态加载脚本可能受限，建议本地起服务器：
> `cd web && python3 -m http.server 8000` → 打开 http://localhost:8000/

## 多数据集结构
- `index.html`      —— 页面（顶部下拉切换数据集）
- `datasets.js`     —— 数据集清单（下拉框据此生成）
- `data/<id>.js`    —— 每次实验一份数据，注册到 window.TRACE_DATASETS[<id>]

## 三路真实数据
| 数据 | 工具 | 驱动页面的 |
|---|---|---|
| 时间轴 / kernel / PCIe / 通信 | torch.profiler（SGLang 内置） | 阶段步骤、繁忙度时间线 |
| 每卡权重分布 | config.json + TP 切分推导 | HBM 显存堆叠条、权重卡片 |
| SM / HBM 利用率 | DCGM（dcgmi dmon） | 实测利用率卡片、SM 点亮比例 |

## 加一个新实验数据（完整流程）

```bash
ID=<id>            # 例：deepseek-v2-lite-tp2
HOST=ubuntu@<ip>
KEY=aws/gpu-explainer-key.pem

# --- A. torch.profiler trace（时间轴） ---
ssh -i $KEY $HOST 'bash ~/capture_trace.sh'
scp -i $KEY "$HOST:~/sglang/profile_log/*TP-0*.gz" traces/
python3 tools/trace_to_steps.py traces/<file>.trace.json.gz -o traces/$ID.json --tp 2

# --- B. 权重分布（每卡装了哪些权重） ---
scp -i $KEY "$HOST:~/.cache/huggingface/hub/models--*/snapshots/*/config.json" traces/$ID-config.json
python3 tools/weights_from_config.py --config traces/$ID-config.json --tp 2 \
  --measured-gb <server.log里的每卡GB> -o traces/$ID-weights.json

# --- C. DCGM 实测利用率（SM / HBM）---
#   首次需在实例上装并起 hostengine：
#   ssh -i $KEY $HOST 'sudo apt-get install -y datacenter-gpu-manager && sudo nv-hostengine'
ssh -i $KEY $HOST 'bash ~/capture_dcgm.sh'        # 采集期间自动发推理请求
scp -i $KEY "$HOST:~/dcgm_raw.txt" traces/$ID-dcgm_raw.txt
python3 tools/parse_dcgm.py traces/$ID-dcgm_raw.txt --interval-ms 100 -o traces/$ID-dcgm.json

# --- D. 先生成一次页面数据（产出 phases，供 D2 对齐算子）---
python3 tools/aggregate_for_web.py traces/$ID.json \
  -o web/data/$ID.js --id $ID \
  --model "模型名" --gpu "机型/互联" --buckets 160 \
  --weights traces/$ID-weights.json \
  --dcgm traces/$ID-dcgm.json

# --- D2. 每步「在算什么」算子（依赖 D 产出的 phases 时间区间）---
python3 tools/ops_in_phases.py traces/$ID.json \
  --phases web/data/$ID.js --id $ID -o traces/$ID-ops.json

# --- D3. 带 --ops 重新生成（把算子挂到每步）---
python3 tools/aggregate_for_web.py traces/$ID.json \
  -o web/data/$ID.js --id $ID \
  --model "模型名" --gpu "机型/互联" --buckets 160 \
  --weights traces/$ID-weights.json \
  --dcgm traces/$ID-dcgm.json \
  --ops traces/$ID-ops.json

# --- E. 在 web/datasets.js 登记一行 ---
#   { id: "<id>", label: "下拉显示名", file: "data/<id>.js" }
```
刷新页面即可在下拉框选到新数据集。B、C、D2/D3 均可选——缺了对应卡片/算子列表自动隐藏。
> D2 需要 D 先产出 phases，所以是「生成 → 提取算子 → 带 --ops 重生成」三步。
> 只要 --buckets 不变，两次生成的 phases 一致，算子能正确对齐。

## 实例上的便捷脚本（setup-sglang.sh / 手动创建）
- `~/run_server.sh`    —— 启动 SGLang 服务
- `~/capture_trace.sh` —— 抓 torch.profiler trace
- `~/capture_dcgm.sh`  —— 推理期间高频采集 DCGM（SM/HBM/NVLink）

## 能实测 vs 示意
- 实测：时间轴、各 kernel 耗时、PCIe/NCCL 通信、SM 活跃率、HBM 活跃率、每卡权重分布（推导+显存对账）、
  **每步实际执行的操作**（从真实 kernel 名归类：RMSNorm/注意力/GEMM/MoE路由/专家GEMM/激活/All-Reduce，带次数+耗时）。
- 示意：具体点亮哪几个 SM 方块、HBM 字节级流向 —— 硬件不暴露物理 SM 调度，任何工具都拿不到。
- 做不到（与 Transformer Explainer 的区别）：实时真实**数值**张量（具体 token、注意力权重矩阵）——
  那需要在浏览器跑模型，几十 GB 的 MoE 模型做不到；本页展示的是真实「操作流程」而非数值。

## 数据三/四路与工具对应
| 数据 | 工具 | 页面元素 |
|---|---|---|
| 时间轴 / kernel / 通信 | trace_to_steps.py + aggregate_for_web.py | 阶段步骤、繁忙度 |
| 每卡权重分布 | weights_from_config.py | HBM 堆叠条、权重卡片 |
| SM / HBM 利用率 | parse_dcgm.py | 实测利用率卡片、SM 点亮比例 |
| 每步在算什么 | ops_in_phases.py | 步骤说明里的「实际执行的操作」列表 |

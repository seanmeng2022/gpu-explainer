#!/usr/bin/env python3
"""
ops_in_phases.py — 从 trace 事件中，为每个宏观阶段提取「真实执行了哪些操作」。
把底层 kernel 名归类成人能看懂的模型操作（层归一化 / QKV投影 / 注意力 / MoE路由 / 专家GEMM / 激活 / 通信…），
统计每类的真实调用次数与累计耗时，输出 JSON 供页面展示「这一步在算什么」。

用法:
  python ops_in_phases.py traces/web_data.json --phases web/data/<id>.js --id <id> -o traces/<id>-ops.json
说明：阶段时间区间从已生成的 data/<id>.js 的 phases 读取（保证与页面一致）。
"""
import argparse, json, re

# kernel 名关键字 → (操作显示名, 在模型里的角色说明)
OP_RULES = [
    ("RMSNorm|LayerNorm|FusedAddRMSNorm", "层归一化 (RMSNorm)", "每个子层前对激活做归一化，稳定数值"),
    ("flash|fmha|attention|mla",          "注意力计算", "Q·Kᵀ 打分、softmax、加权 V（MLA 潜在注意力）"),
    ("softmax",                            "Softmax", "注意力分数归一化为概率"),
    ("gatherTopK|topk|router|gate|moe_align|count_and_sort", "MoE 路由 (选专家)", "router 给每个 token 打分，选 top-k 个专家并按专家分组"),
    ("fused_moe|grouped_gemm|moe_kernel",  "MoE 专家计算", "被选中的专家对各自分到的 token 做前馈 GEMM"),
    ("act_and_mul|silu|gelu|swiglu",       "激活函数 (SwiGLU)", "前馈网络的门控激活"),
    ("cutlass|cublas|ampere.*gemm|splitKreduce|s16816gemm|wmma_tensorop", "矩阵乘法 GEMM", "QKV / 输出 / 词表投影等稠密矩阵乘"),
    ("AllReduce|nccl",                     "跨卡 All-Reduce", "张量并行：把分片结果在 GPU 间求和合并"),
    ("Memcpy|memcpy",                      "数据搬运 (PCIe/显存)", "主机↔显存或显存内拷贝"),
    ("elementwise|copy_|mul|add|scatter|index", "逐元素运算", "加/乘/拷贝/索引等向量化小算子"),
    ("embedding|embed",                    "词嵌入查表", "token id → 向量"),
]
_compiled = [(re.compile(p, re.I), name, desc) for p, name, desc in OP_RULES]

def classify(name):
    for rx, disp, desc in _compiled:
        if rx.search(name):
            return disp, desc
    return None

def load_phases_from_js(path, ds_id):
    txt = open(path, encoding="utf-8").read()
    m = re.search(r'window\.TRACE_DATASETS\[[^\]]*\]\s*=\s*(\{.*\});\s*$', txt, re.S)
    obj = json.loads(m.group(1))
    return obj["phases"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("trace_json", help="trace_to_steps.py 产出（含 steps，带 t0/dur）")
    ap.add_argument("--phases", required=True, help="web/data/<id>.js（读阶段时间区间）")
    ap.add_argument("--id", required=True)
    ap.add_argument("-o", "--out", required=True)
    args = ap.parse_args()

    d = json.load(open(args.trace_json, encoding="utf-8"))
    steps = d["steps"]
    phases = load_phases_from_js(args.phases, args.id)

    # 一层 Transformer(MoE) 的「理想」操作流水顺序，用于把真实序列归整成可读步骤
    LAYER_FLOW = [
        ("层归一化 (RMSNorm)", "层归一化 (RMSNorm)"),
        ("矩阵乘法 GEMM", "QKV 投影 (GEMM)"),
        ("注意力计算", "注意力 (Q·Kᵀ·softmax·V)"),
        ("跨卡 All-Reduce", "注意力后 All-Reduce"),
        ("层归一化 (RMSNorm)", "层归一化 (RMSNorm)"),
        ("MoE 路由 (选专家)", "MoE 路由 (router 选 top-k 专家)"),
        ("MoE 专家计算", "专家前馈 (分组 GEMM)"),
        ("激活函数 (SwiGLU)", "SwiGLU 激活"),
        ("跨卡 All-Reduce", "MoE 后 All-Reduce"),
    ]

    # 一层 MoE Transformer 的标准执行流水（顺序确定，已被真实 trace 序列证实）。
    # 每个条目：(显示名, 一句话说明)
    LAYER_STEPS = [
        ("① 层归一化", "RMSNorm：对输入激活归一化"),
        ("② QKV 投影", "GEMM：算出 Query/Key/Value"),
        ("③ 注意力", "Q·Kᵀ 打分 → softmax → 加权 V（MLA 潜在注意力）"),
        ("④ 注意力输出 + All-Reduce", "输出投影 GEMM，并把张量并行分片在卡间求和"),
        ("⑤ 层归一化", "RMSNorm：进入 MoE 前再归一化"),
        ("⑥ MoE 路由", "router 给每个 token 打分，选 top-k 个专家并按专家分组"),
        ("⑦ 专家前馈", "被选中的专家对各自分到的 token 做 GEMM + SwiGLU 激活"),
        ("⑧ MoE 输出 + All-Reduce", "合并专家输出，并把分片在卡间求和"),
    ]

    def has_op(events, name):
        return any(classify(e["name"]) and classify(e["name"])[0] == name for e in events)

    result = []
    for ph in phases:
        t0, t1 = ph["t0"], ph["t1"]
        ev = sorted([e for e in steps if t0 <= e["t0"] < t1], key=lambda x: x["t0"])
        agg = {}  # disp -> {count, ms, desc}
        for e in ev:
            c = classify(e["name"])
            if not c:
                continue
            disp, desc = c
            a = agg.setdefault(disp, {"count": 0, "ms": 0.0, "desc": desc})
            a["count"] += 1
            a["ms"] += e["dur"]
        ops = [{"op": k, "count": v["count"], "ms": round(v["ms"], 3), "desc": v["desc"]}
               for k, v in agg.items()]
        ops.sort(key=lambda x: -x["ms"])

        # 估算层数：用注意力调用次数（每层一次）
        n_layers = sum(1 for e in ev if classify(e["name"]) and classify(e["name"])[0] == "注意力计算")
        # 该步是否含 MoE（决定展示完整层流水还是仅注意力部分）
        is_moe = has_op(ev, "MoE 专家计算")
        if ph["macro"] == "kernel" and n_layers >= 1:
            flow = [{"name": s[0], "desc": s[1]} for s in LAYER_STEPS] if is_moe \
                else [{"name": s[0], "desc": s[1]} for s in LAYER_STEPS[:4]]
        else:
            flow = []

        result.append({"t0": t0, "t1": t1, "macro": ph["macro"],
                        "ops": ops, "n_layers": n_layers, "layer_flow": flow})

    json.dump({"phase_ops": result}, open(args.out, "w"), ensure_ascii=False, indent=1)
    print("✓ 写出", args.out)
    for i, ph in enumerate(result):
        top = "、".join(f"{o['op']}×{o['count']}" for o in ph["ops"][:4])
        print(f"  步{i+1} [{ph['macro']}] {ph['t0']:.0f}-{ph['t1']:.0f}ms: {top or '(无可识别算子)'}")

if __name__ == "__main__":
    main()

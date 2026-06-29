#!/usr/bin/env python3
"""
aggregate_for_web.py — 把 trace_to_steps.py 产出的 web_data.json（几千个事件）
聚合成页面可直接渲染的紧凑数据，并输出为 web_data.js（window.TRACE_DATA=...），
以便 index.html 在 file:// 下用 <script> 直接加载（绕开本地 fetch 的 CORS 限制）。

输出结构:
  window.TRACE_DATA = {
    meta:   { total_ms, tp, model, gpu, comm_bytes },
    breakdown: [ {kind, ms, pct} ... ],          # 按耗时分解（来自各事件累计）
    lanes:  ["cpu","pcie","gpu","comm"],
    timeline: [ {t, cpu, pcie, gpu, comm} ... ],  # N 个时间桶, 每桶各 lane 繁忙度 0..1
  }

用法:
  python aggregate_for_web.py traces/web_data.json -o web/web_data.js \
      --model "DeepSeek-V2-Lite-Chat" --gpu "2x A10G (PCIe)" --buckets 160
"""
import argparse
import json

LANES = ["cpu", "pcie", "gpu", "comm"]

# kind -> 展示用中文名 + 归到哪条 lane（与前端配色一致）
KIND_LABEL = {
    "cpu_op": "CPU 算子/下发",
    "memcpy": "PCIe 数据搬运",
    "gemm": "GEMM 矩阵乘",
    "attention": "注意力",
    "moe_expert": "MoE 专家计算",
    "elementwise": "逐元素/归一化",
    "comm_allreduce": "跨卡 All-Reduce",
    "comm_other": "其它通信",
    "other_kernel": "其它 kernel",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("infile", help="trace_to_steps.py 产出的 web_data.json")
    ap.add_argument("-o", "--out", default="web/web_data.js")
    ap.add_argument("--model", default="(unknown model)")
    ap.add_argument("--gpu", default="(unknown gpu)")
    ap.add_argument("--buckets", type=int, default=160)
    ap.add_argument("--id", default=None,
                    help="数据集 id。给定则输出注册式 window.TRACE_DATASETS[id]=...（多数据集页面用）；"
                         "省略则输出 window.TRACE_DATA=...（单数据集）。")
    ap.add_argument("--weights", default=None,
                    help="weights_from_config.py 产出的 weights.json，合并进 meta.weights（每卡权重分布）。")
    ap.add_argument("--dcgm", default=None,
                    help="parse_dcgm.py 产出的 dcgm.json，合并进 meta.dcgm（实测 SM/HBM 活跃率）。")
    ap.add_argument("--ops", default=None,
                    help="ops_in_phases.py 产出的 *-ops.json，把每步真实算子挂到 phases[i].ops。"
                         "注意：ops 按阶段时间对齐，需与本次生成的 phases 一致（先生成一次再跑 ops，再带 --ops 重生成）。")
    args = ap.parse_args()
    weights = json.load(open(args.weights, encoding="utf-8")) if args.weights else None
    dcgm = json.load(open(args.dcgm, encoding="utf-8")) if args.dcgm else None
    ops_data = json.load(open(args.ops, encoding="utf-8"))["phase_ops"] if args.ops else None

    d = json.load(open(args.infile, encoding="utf-8"))
    steps = d["steps"]
    summ = d.get("summary", {})
    total = summ.get("total_ms") or max(s["t0"] + s["dur"] for s in steps)

    # ---- 耗时分解（按 kind 累计） ----
    by_kind = {}
    for s in steps:
        by_kind[s["kind"]] = by_kind.get(s["kind"], 0.0) + s["dur"]
    busy_sum = sum(by_kind.values()) or 1.0
    breakdown = [
        {"kind": k, "label": KIND_LABEL.get(k, k), "ms": round(v, 3), "pct": round(v / busy_sum * 100, 1)}
        for k, v in sorted(by_kind.items(), key=lambda x: -x[1])
    ]

    # ---- 时间分桶：每桶记录各 lane 的覆盖繁忙度（0..1，重叠 clamp 到 1） ----
    nb = args.buckets
    bw = total / nb
    # 每个 lane 每桶累计被事件覆盖的时长
    cover = {ln: [0.0] * nb for ln in LANES}
    for s in steps:
        ln = s["lane"]
        if ln not in cover:
            continue
        a, b = s["t0"], s["t0"] + s["dur"]
        bi0 = max(0, int(a / bw))
        bi1 = min(nb - 1, int(b / bw))
        for bi in range(bi0, bi1 + 1):
            seg_a = max(a, bi * bw)
            seg_b = min(b, (bi + 1) * bw)
            if seg_b > seg_a:
                cover[ln][bi] += seg_b - seg_a
    # 每桶 GPU 子类别覆盖（看 GPU 此刻在算什么：gemm / attention / moe_expert / 其它）
    GPU_KINDS = ["gemm", "attention", "moe_expert", "elementwise", "other_kernel"]
    gpu_cover = {k: [0.0] * nb for k in GPU_KINDS}
    for s in steps:
        if s["lane"] != "gpu":
            continue
        k = s["kind"] if s["kind"] in GPU_KINDS else "other_kernel"
        a, b = s["t0"], s["t0"] + s["dur"]
        bi0 = max(0, int(a / bw))
        bi1 = min(nb - 1, int(b / bw))
        for bi in range(bi0, bi1 + 1):
            seg = min(b, (bi + 1) * bw) - max(a, bi * bw)
            if seg > 0:
                gpu_cover[k][bi] += seg

    timeline = []
    for bi in range(nb):
        row = {"t": round(bi * bw, 3)}
        for ln in LANES:
            row[ln] = round(min(1.0, cover[ln][bi] / bw), 3)
        # 该桶 GPU 占比最高的子类别（用于显示"GPU 在做什么"）
        kinds = {k: gpu_cover[k][bi] for k in GPU_KINDS if gpu_cover[k][bi] > 0}
        row["gpu_top"] = max(kinds, key=kinds.get) if kinds else None
        timeline.append(row)

    # ---- 阶段划分：按每桶主导活动分类，再做游程合并 ----
    def classify(b):
        cpu, pcie, gpu, comm = b["cpu"], b["pcie"], b["gpu"], b["comm"]
        if comm > 0.08:
            return "comm"                      # 卡间 All-Reduce 主导
        if gpu > 0.15:
            return "moe" if b.get("gpu_top") == "moe_expert" else "compute"
        if pcie > 0.01 and gpu < 0.15:
            return "io"                        # PCIe 搬运（GPU 还没忙）
        if cpu > 0.1 and gpu < 0.1:
            return "cpu"                       # 纯 CPU（下发/采样）
        return "idle"

    labels = [classify(b) for b in timeline]
    # 游程合并
    runs = []
    for i, lab in enumerate(labels):
        if runs and runs[-1]["label"] == lab:
            runs[-1]["b1"] = i
        else:
            runs.append({"label": lab, "b0": i, "b1": i})
    # 把过短(<2桶)的非关键游程并入相邻
    merged = []
    for r in runs:
        span = r["b1"] - r["b0"] + 1
        if merged and span < 2 and r["label"] in ("idle", "cpu"):
            merged[-1]["b1"] = r["b1"]
        else:
            merged.append(r)
    PHASE_INFO = {
        "io":      {"title": "CPU 下发 + PCIe 搬运", "lanes": ["cpu", "pcie"]},
        "cpu":     {"title": "CPU 工作（下发/采样）", "lanes": ["cpu"]},
        "compute": {"title": "GPU 计算（GEMM/注意力）", "lanes": ["gpu"]},
        "moe":     {"title": "GPU MoE 专家计算", "lanes": ["gpu"]},
        "comm":    {"title": "卡间 All-Reduce 通信", "lanes": ["gpu", "comm"]},
        "idle":    {"title": "空闲/过渡", "lanes": []},
    }
    # ---- 二级聚合：合并成宏观阶段 ----
    def macro_of(lab):
        if lab in ("io", "cpu"):
            return "host"
        if lab in ("compute", "moe", "comm"):
            return "kernel"
        return "wait"

    macro_runs = []
    for r in merged:
        m = macro_of(r["label"])
        if macro_runs and macro_runs[-1]["m"] == m:
            macro_runs[-1]["b1"] = r["b1"]
            macro_runs[-1]["subs"].extend(r["subs"] if "subs" in r else [r["label"]])
        else:
            macro_runs.append({"m": m, "b0": r["b0"], "b1": r["b1"], "subs": [r["label"]]})

    # ---- 合并碎片：把短的 host/kernel 段并入相邻同区，减少 decode 阶段的碎裂 ----
    GAP_MS = 20.0   # 超过此长度的 wait 视为「测量空档/forward 间隔」，作为 token 分界
    FRAG_MS = 1.6   # 短于此的非 wait 段并入前一段
    coalesced = []
    for r in macro_runs:
        span_ms = (r["b1"] - r["b0"] + 1) * bw
        if (coalesced and r["m"] != "wait"
                and span_ms < FRAG_MS
                and coalesced[-1]["m"] != "wait"):
            coalesced[-1]["b1"] = r["b1"]
            coalesced[-1]["subs"].extend(r["subs"])
        else:
            coalesced.append(r)

    # ---- 分组：用「长 wait」作为 token 边界，划出 Prefill / Decode-N ----
    # 规则：第一段有效计算所在的 token 组 = Prefill；之后每跨一个长 wait → 新的 Decode token。
    def is_long_gap(r):
        return r["m"] == "wait" and (r["b1"] - r["b0"] + 1) * bw >= GAP_MS

    # ---- 关键修正：推理起点 = 第一个 kernel 前「紧邻的那段 CPU 准备」 ----
    # 这样 Prefill 的第一步就是 CPU 准备（下发/搬运），而不是直接跳到 GPU 计算。
    first_kernel = next((idx for idx, r in enumerate(coalesced) if r["m"] == "kernel"), None)
    inference_start = first_kernel
    if first_kernel is not None:
        # 向前找紧贴 kernel 的 host 段（中间不能隔着 long gap）作为真正起点
        j = first_kernel - 1
        while j >= 0 and coalesced[j]["m"] == "host" and not is_long_gap(coalesced[j]):
            inference_start = j
            j -= 1

    phases = []
    token_idx = -1   # -1 表示尚未进入推理
    started = False
    for ci, r in enumerate(coalesced):
        # 推理正式开始前（CPU 准备段之前）的 host/wait 都归为"预热"
        pre_inference = (inference_start is not None and ci < inference_start)
        b0, b1 = r["b0"], r["b1"]
        t0, t1 = b0 * bw, (b1 + 1) * bw
        seg = timeline[b0:b1 + 1]
        avg = {ln: round(sum(x[ln] for x in seg) / len(seg), 3) for ln in LANES}
        subs = set(r["subs"])
        has_moe = "moe" in subs
        has_comm = "comm" in subs
        ms = t1 - t0

        if pre_inference:
            # 推理正式开始前的一切（预热 forward 残留 + 之后的大空档）都归"测量空档"
            group = "gap"; grp_label = "测量空档（非推理）"; macro = "gap"
            title = "测量空档（profiler 预热）"
            desc = ("profiler 预热阶段：包含一次预热 forward 的残留与其后的空档，CPU/GPU 基本空闲，"
                    "属于测量噪声，不是被完整记录的那次推理。")
            lanes = []
        elif is_long_gap(r):
            # 推理中途的长空档：forward 间隔，标志下一个 token
            group = "gap"; grp_label = "测量空档（非推理）"; macro = "gap"
            title = "测量空档（forward 间隔）"
            desc = ("两次 forward 之间的间隔，CPU 与 GPU 都基本空闲 —— 属于测量噪声。"
                    "真实部署连续生成时这类空档会小得多。")
            lanes = []
            if started:
                token_idx += 1   # 下一段计算归入新 token
        elif r["m"] == "wait":
            if not started:
                continue
            group = f"tok{token_idx}"
            grp_label = "Prefill（首 token）" if token_idx == 0 else f"Decode（第 {token_idx+1} 个 token）"
            macro = "wait"; title = "短暂过渡"; desc = "层与层之间的短暂空档。"; lanes = []
        else:
            if not started:
                started = True
                token_idx = 0
            else:
                # 每个 token 的模式是「host 准备 → kernel 计算」。
                # 因此新 token 的边界 = 一段 kernel 计算结束后、又出现 host 准备时。
                if r["m"] == "host" and phases and phases[-1]["macro"] == "kernel":
                    token_idx += 1
            group = f"tok{token_idx}"
            grp_label = "Prefill 阶段（一次处理整个输入提示）" if token_idx == 0 else "Decode 阶段（逐个生成后续 token）"
            macro = r["m"]
            is_prefill = (token_idx == 0)
            if r["m"] == "host":
                if is_prefill:
                    title = "主机：准备输入 + 下发"
                    desc = ("CPU 把整段输入提示 tokenize、组织成张量，经 PCIe 搬进 GPU 显存并下发 kernel。"
                            "这是一次推理的开场，GPU 此时基本空闲。")
                else:
                    title = "主机：采样 + 下一步下发"
                    desc = ("CPU 拿到上一个 token 的 logits 做采样得到新 token，再把它作为输入下发下一轮。"
                            "Decode 每生成一个 token 都要这样和 GPU 来回一次。")
                lanes = ["cpu", "pcie"]
            else:  # kernel
                bits = ["GEMM 矩阵乘 / 注意力"]
                if has_moe: bits.append("MoE 专家计算")
                if has_comm: bits.append("跨卡 All-Reduce")
                if is_prefill:
                    title = "Prefill：GPU 逐层计算" + ("（含 MoE）" if has_moe else "")
                    desc = ("一次性把整个输入提示的所有 token 喂过全部 " + "、".join(bits)
                            + "。Prefill 并行处理很多 token，算力利用率高；MoE 层里每个 token 经 router 选专家、"
                              "张量并行分片靠 All-Reduce 合并。算完顺便建立 KV cache 供 Decode 复用。")
                else:
                    title = "Decode：GPU 逐层计算" + ("（含 MoE）" if has_moe else "")
                    desc = ("只为「1 个」新 token 走完全部层。注意力直接复用 Prefill 建好的 KV cache，"
                            "所以注意力很轻；但权重仍要从 HBM 全量读一遍，于是 Decode 往往是访存受限、"
                            "算力利用率低于 Prefill。每个新 token 都重复一次本阶段。")
                lanes = ["gpu"] + (["comm"] if has_comm else [])

        phases.append({
            "macro": macro, "group": group, "group_label": grp_label,
            "title": title, "desc": desc, "lanes": lanes,
            "has_moe": has_moe, "has_comm": has_comm,
            "t0": round(t0, 3), "t1": round(t1, 3), "ms": round(ms, 3),
            "b0": b0, "b1": b1, "avg": avg,
        })

    # ---- 末道合并：同组内相邻的同 macro 段合并成一步（消除残余碎片） ----
    fused = []
    for p in phases:
        if (fused and fused[-1]["macro"] == p["macro"] and fused[-1]["group"] == p["group"]):
            q = fused[-1]
            q["t1"] = p["t1"]; q["b1"] = p["b1"]; q["ms"] = round(q["t1"] - q["t0"], 3)
            q["has_moe"] = q["has_moe"] or p["has_moe"]
            q["has_comm"] = q["has_comm"] or p["has_comm"]
            seg = timeline[q["b0"]:q["b1"] + 1]
            q["avg"] = {ln: round(sum(x[ln] for x in seg) / len(seg), 3) for ln in LANES}
            # 标题/描述可能因 moe/comm 改变，重算 kernel 标题
            if q["macro"] == "kernel":
                bits = ["GEMM 矩阵乘 / 注意力"]
                if q["has_moe"]: bits.append("MoE 专家计算")
                if q["has_comm"]: bits.append("跨卡 All-Reduce")
                q["title"] = "GPU 逐层计算" + ("（含 MoE 专家）" if q["has_moe"] else "")
                q["lanes"] = ["gpu"] + (["comm"] if q["has_comm"] else [])
        else:
            fused.append(p)
    phases = fused

    # 去掉测量空档(gap)，保留 Prefill(tok0) + 一个「完整的」Decode 组，体现两阶段差异。
    # 注意：trace 里靠前的 decode 段可能很短、计算不完整（识别不到层），
    # 因此选第一个「含 kernel 计算的层数 >=1」的非 tok0 组作为 Decode 代表。
    # n_layers 此时尚未挂上（在 --ops 合并阶段才有），改用 has_moe 判断哪个 decode 组计算完整。
    def grp_has_moe(g):
        return any(p.get("has_moe") for p in phases if p.get("group") == g)
    decode_groups = sorted({p["group"] for p in phases
                            if p.get("group", "").startswith("tok") and p["group"] != "tok0"})
    decode_pick = next((g for g in decode_groups if grp_has_moe(g)), None)
    keep = {"tok0"} | ({decode_pick} if decode_pick else set())
    phases = [p for p in phases if p.get("group") in keep]
    # Decode 组重新标注为「第 1 个 token」，避免显示成真实的 tok 序号
    for p in phases:
        if p.get("group") == decode_pick:
            p["group"] = "decode"

    # 把每步真实算子挂上去（按时间区间匹配 ops_data）
    if ops_data:
        for ph in phases:
            best, bestov = None, 0
            for od in ops_data:
                ov = min(ph["t1"], od["t1"]) - max(ph["t0"], od["t0"])
                if ov > bestov:
                    bestov, best = ov, od
            ph["ops"] = best["ops"] if best else []
            ph["n_layers"] = best.get("n_layers", 0) if best else 0
            ph["layer_flow"] = best.get("layer_flow", []) if best else []

    out = {
        "meta": {
            "total_ms": round(total, 3),
            "tp": summ.get("tp"),
            "model": args.model,
            "gpu": args.gpu,
            "comm_bytes": summ.get("comm_bytes", 0),
            "event_count": len(steps),
            "note": summ.get("note", ""),
            "weights": weights,
            "dcgm": (dcgm.get("summary") if dcgm else None),
        },
        "breakdown": breakdown,
        "lanes": LANES,
        "timeline": timeline,
        "phases": phases,
    }

    import os
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write("// 自动生成：真实推理 trace 聚合数据。勿手改。\n")
        if args.id:
            # 注册式：多数据集页面用
            f.write("window.TRACE_DATASETS = window.TRACE_DATASETS || {};\n")
            f.write('window.TRACE_DATASETS[%s] = ' % json.dumps(args.id))
        else:
            f.write("window.TRACE_DATA = ")
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write(";\n")

    print(f"✓ 写出 {args.out}")
    if args.id:
        print(f"  注册为 TRACE_DATASETS[{args.id!r}] —— 记得在 web/datasets.js 登记一行")
    print(f"  总时长 {total:.1f} ms · {len(steps)} 事件 → {nb} 时间桶 · {len(phases)} 阶段")
    print("  耗时分解:")
    for b in breakdown:
        print(f"    {b['label']:16s} {b['ms']:8.2f} ms  {b['pct']:5.1f}%")


if __name__ == "__main__":
    main()

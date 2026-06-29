#!/usr/bin/env python3
"""
trace_to_steps.py — 把 SGLang / torch.profiler 导出的 Chrome Trace
转换成 GPU Explainer 页面用的 web_data.json。

用法:
    python trace_to_steps.py infer.trace.json.gz -o web_data.json
    python trace_to_steps.py infer.trace.json    -o web_data.json --tp 8

输入: Chrome Trace 格式 (torch.profiler 的 export_chrome_trace / SGLang 的 *.trace.json.gz)。
输出: web_data.json, 结构与页面里的 STEPS / 时间轴一致, 直接喂给前端。

注意:
  - 时间轴 / kernel 耗时 / PCIe 搬运 / NCCL 通信 = 真实实测。
  - SM 占用 / warp / HBM 带宽 torch.profiler 给不了 -> 这里只能留 None, 前端按"示意"处理,
    或后续用 nsys/ncu 的数据补进来。
"""
import argparse
import gzip
import json
import re
from collections import defaultdict

# ---- kernel 名 -> 阶段分类 (按关键字, 大小写不敏感) ----
KERNEL_RULES = [
    ("comm_alltoall", re.compile(r"(alltoall|all_to_all|deepep|dispatch|combine)", re.I)),
    ("comm_allreduce", re.compile(r"(allreduce|all_reduce|nccl.*reduce)", re.I)),
    ("comm_other",     re.compile(r"(nccl|ncclKernel)", re.I)),
    ("moe_expert",     re.compile(r"(moe|expert|grouped_gemm|topk|router|gate)", re.I)),
    ("attention",      re.compile(r"(attention|flash|fmha|mla|softmax)", re.I)),
    ("gemm",           re.compile(r"(gemm|matmul|\bmm\b|cutlass|cublas|linear)", re.I)),
    ("elementwise",    re.compile(r"(elementwise|add|mul|norm|rms|silu|gelu|act)", re.I)),
]

MEMCPY_RE = re.compile(r"(memcpy|HtoD|DtoH|Memcpy)", re.I)


def classify_kernel(name: str) -> str:
    for label, rx in KERNEL_RULES:
        if rx.search(name):
            return label
    return "other_kernel"


def load_trace(path: str) -> dict:
    op = gzip.open if path.endswith(".gz") else open
    with op(path, "rt", encoding="utf-8") as f:
        return json.load(f)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("trace", help="Chrome trace (.json or .json.gz)")
    ap.add_argument("-o", "--out", default="web_data.json")
    ap.add_argument("--tp", type=int, default=None, help="张量并行卡数(用于标注/分组)")
    args = ap.parse_args()

    data = load_trace(args.trace)
    events = data.get("traceEvents", data if isinstance(data, list) else [])

    # 只看有时长的完整事件 (ph == "X")
    spans = [e for e in events if e.get("ph") == "X" and "dur" in e and "ts" in e]
    if not spans:
        raise SystemExit("trace 里没有可用的 X 事件 (起止+时长). 确认是 torch.profiler 导出的 Chrome Trace.")

    t0 = min(e["ts"] for e in spans)

    # pid/tid -> 是 CPU 线程还是某个 GPU stream, torch.profiler 会在 metadata(ph=='M') 里标注
    # 这里用简单启发式: cat 带 'cpu' 的算 CPU, 'kernel'/'gpu_memcpy' 算 GPU。
    out_steps = []
    cat_dur = defaultdict(float)   # 各类别累计耗时 (µs), 用于汇总
    comm_bytes = 0

    for e in spans:
        cat = (e.get("cat") or "").lower()
        name = e.get("name") or ""
        ts = (e["ts"] - t0) / 1000.0   # -> ms, 相对起点
        dur = e["dur"] / 1000.0        # -> ms
        args_ = e.get("args", {}) or {}

        if "cpu" in cat or cat == "cpu_op":
            kind, lane = "cpu_op", "cpu"
        elif MEMCPY_RE.search(name) or "memcpy" in cat:
            kind, lane = "memcpy", "pcie"
            comm_bytes += int(args_.get("bytes", 0) or 0)
        elif "kernel" in cat or "cuda" in cat:
            label = classify_kernel(name)
            lane = "comm" if label.startswith("comm_") else "gpu"
            kind = label
        else:
            continue

        cat_dur[kind] += e["dur"]
        out_steps.append({
            "lane": lane,          # cpu / pcie / gpu / comm
            "kind": kind,          # 细分类别
            "name": name[:80],
            "t0": round(ts, 4),
            "dur": round(dur, 4),
            "device": args_.get("device", args_.get("stream")),
            # SM 占用 / 带宽: torch.profiler 给不了, 留 None, 让前端按示意处理
            "sm_util": None,
            "mem_bw": None,
        })

    out_steps.sort(key=lambda s: s["t0"])
    total_ms = max((s["t0"] + s["dur"]) for s in out_steps)

    summary = {
        "total_ms": round(total_ms, 4),
        "tp": args.tp,
        "comm_bytes": comm_bytes,
        "by_kind_ms": {k: round(v / 1000.0, 4) for k, v in sorted(cat_dur.items(), key=lambda x: -x[1])},
        "note": "时间轴/kernel/PCIe/NCCL 为实测; SM 占用与带宽为 null(torch.profiler 不提供, 需 nsys/ncu).",
    }

    web = {"summary": summary, "steps": out_steps}
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(web, f, ensure_ascii=False, indent=2)

    print(f"✓ 写出 {args.out}")
    print(f"  事件数: {len(out_steps)}  总时长: {total_ms:.2f} ms")
    print("  各类别耗时(ms):")
    for k, v in summary["by_kind_ms"].items():
        print(f"    {k:16s} {v:8.3f}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
parse_dcgm.py — 解析 `dcgmi dmon` 输出，提取每卡真实指标的时间序列与汇总。
字段顺序需与采集时一致：SMACT(1002) SMOCC(1003) DRAMA(1005) NVLTX(1011) NVLRX(1012)

输出 JSON：
  { "interval_ms": 100,
    "gpus": {"0": {...}, "1": {...}},          # 每卡时间序列
    "summary": {"sm_active_pct": .., "dram_active_pct": .., "sm_occupancy_pct":..,
                "nvlink_tx_bytes":.., "nvlink_rx_bytes":..,
                "active_gpus":[0,1]} }          # 推理期间(非零)的均值/峰值

用法: python parse_dcgm.py traces/dcgm_raw.txt --interval-ms 100 -o traces/dcgm.json
"""
import argparse, json, re

COLS = ["smact", "smocc", "drama", "nvltx", "nvlrx"]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("infile")
    ap.add_argument("--interval-ms", type=int, default=100)
    ap.add_argument("-o", "--out", default=None)
    args = ap.parse_args()

    series = {}   # gpu_id -> list of dict
    for line in open(args.infile):
        m = re.match(r"\s*GPU\s+(\d+)\s+(.*)", line)
        if not m:
            continue
        gid = int(m.group(1))
        vals = m.group(2).split()
        if len(vals) < 5:
            continue
        try:
            row = {COLS[i]: float(vals[i]) for i in range(5)}
        except ValueError:
            continue
        series.setdefault(gid, []).append(row)

    # 找出参与推理的卡（smact 出现过明显非零）
    active = [g for g, rows in series.items() if max(r["smact"] for r in rows) > 0.05]

    def summ(rows):
        busy = [r for r in rows if r["smact"] > 0.05]   # 只统计计算活跃期
        if not busy:
            busy = rows
        n = len(busy)
        avg = lambda k: round(sum(r[k] for r in busy) / n, 4)
        mx = lambda k: round(max(r[k] for r in rows), 4)
        return {
            "sm_active_avg": avg("smact"), "sm_active_max": mx("smact"),
            "sm_occupancy_avg": avg("smocc"), "sm_occupancy_max": mx("smocc"),
            "dram_active_avg": avg("drama"), "dram_active_max": mx("drama"),
            "nvlink_tx_bytes_max": mx("nvltx"), "nvlink_rx_bytes_max": mx("nvlrx"),
            "samples": len(rows), "busy_samples": len(busy),
        }

    gpus = {str(g): {"series": series[g], "stats": summ(series[g])} for g in series}

    # 跨活跃卡的总体汇总
    all_busy = [r for g in active for r in series[g] if r["smact"] > 0.05]
    n = max(1, len(all_busy))
    overall = {
        "active_gpus": sorted(active),
        "sm_active_pct": round(sum(r["smact"] for r in all_busy) / n * 100, 1),
        "sm_occupancy_pct": round(sum(r["smocc"] for r in all_busy) / n * 100, 1),
        "dram_active_pct": round(sum(r["drama"] for r in all_busy) / n * 100, 1),
        "nvlink_active": any(r["nvltx"] > 0 or r["nvlrx"] > 0 for g in series for r in series[g]),
        "interval_ms": args.interval_ms,
    }

    out = {"interval_ms": args.interval_ms, "gpus": gpus, "summary": overall}
    txt = json.dumps(out, ensure_ascii=False, indent=1)
    if args.out:
        open(args.out, "w").write(txt)
        print("✓ 写出", args.out)
    print(f"活跃卡: {overall['active_gpus']}")
    print(f"SM 活跃率均值 {overall['sm_active_pct']}% · SM 占用 {overall['sm_occupancy_pct']}% · HBM 活跃 {overall['dram_active_pct']}%")
    print(f"NVLink 流量: {'有' if overall['nvlink_active'] else '无（A10G 无 NVLink，走 PCIe）'}")

if __name__ == "__main__":
    main()

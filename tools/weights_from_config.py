#!/usr/bin/env python3
"""
weights_from_config.py — 按真实 model config + TP 切分，推导每张 GPU 加载了哪些权重。
输出一段 JSON（合并进 web 数据的 meta.weights 字段）。

数据来源全部真实：
  - config.json（架构：层数/维度/专家数）
  - TP 切分规则（确定性）
  - 可与 server.log 的实测每卡显存对账

用法:
  python weights_from_config.py --config <config.json> --tp 2 [--measured-gb 14.81]
"""
import argparse, json

def derive(cfg, tp):
    H = cfg["hidden_size"]; L = cfg["num_hidden_layers"]; V = cfg["vocab_size"]
    I_dense = cfg["intermediate_size"]; I_moe = cfg["moe_intermediate_size"]
    n_exp = cfg["n_routed_experts"]; n_shared = cfg.get("n_shared_experts", 0)
    n_head = cfg["num_attention_heads"]
    kv_lora = cfg.get("kv_lora_rank", 0); q_nope = cfg.get("qk_nope_head_dim", 0)
    q_rope = cfg.get("qk_rope_head_dim", 0); v_head = cfg.get("v_head_dim", H // n_head)
    first_dense = cfg.get("first_k_dense_replace", 0)
    bpp = 2  # bf16

    embed = V * H
    lmhead = V * H
    attn_per = (H * kv_lora + kv_lora * (n_head * (q_nope + v_head))
                + H * (n_head * q_rope) + (n_head * v_head) * H)
    dense_ffn = 3 * H * I_dense
    moe_ffn = n_exp * (3 * H * I_moe) + n_shared * (3 * H * I_moe) + H * n_exp
    n_moe = L - first_dense

    parts = [
        ("embedding", "词嵌入 Embedding", embed, "按词表维度切分到各卡"),
        ("attention", f"注意力权重（{L} 层 MLA）", L * attn_per, "Q/K/V/O 投影，按注意力头切分"),
        ("dense_ffn", f"稠密 FFN（前 {first_dense} 层）", first_dense * dense_ffn, "gate/up/down 矩阵，按中间维切分"),
        ("moe_experts", f"MoE 专家（{n_moe} 层 × {n_exp}+{n_shared} 专家）", n_moe * moe_ffn,
         f"每 token 仅激活 {cfg.get('num_experts_per_tok','?')} 个专家；权重按中间维切分到各卡"),
        ("lm_head", "输出投影 LM head", lmhead, "按词表维度切分到各卡"),
    ]
    total = sum(p[2] for p in parts)
    GB = 1024 ** 3
    out = []
    for key, label, p, how in parts:
        out.append({
            "key": key, "label": label,
            "total_gb": round(p * bpp / GB, 3),
            "per_gpu_gb": round(p * bpp / GB / tp, 3),
            "pct": round(p / total * 100, 1),
            "how": how,
        })
    return {
        "tp": tp,
        "dtype": "bfloat16",
        "params_b": round(total / 1e9, 2),
        "total_gb": round(total * bpp / GB, 2),
        "per_gpu_gb": round(total * bpp / GB / tp, 2),
        "parts": out,
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", required=True)
    ap.add_argument("--tp", type=int, default=2)
    ap.add_argument("--measured-gb", type=float, default=None, help="server.log 实测每卡权重显存，用于对账")
    ap.add_argument("-o", "--out", default=None, help="写出 JSON；省略则打印")
    args = ap.parse_args()
    cfg = json.load(open(args.config))
    w = derive(cfg, args.tp)
    if args.measured_gb:
        w["measured_per_gpu_gb"] = args.measured_gb
    txt = json.dumps(w, ensure_ascii=False, indent=2)
    if args.out:
        open(args.out, "w").write(txt)
        print("✓ 写出", args.out)
    print(f"每卡推导 {w['per_gpu_gb']} GB" + (f" · 实测 {args.measured_gb} GB" if args.measured_gb else ""))
    for p in w["parts"]:
        print(f"  {p['label']:30s} 每卡 {p['per_gpu_gb']:6.2f} GB ({p['pct']:4.1f}%)")

if __name__ == "__main__":
    main()

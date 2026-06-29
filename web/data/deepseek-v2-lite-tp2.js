// 自动生成：真实推理 trace 聚合数据。勿手改。
window.TRACE_DATASETS = window.TRACE_DATASETS || {};
window.TRACE_DATASETS["deepseek-v2-lite-tp2"] = {
 "meta": {
  "total_ms": 207.824,
  "tp": 2,
  "model": "DeepSeek-V2-Lite-Chat (MoE)",
  "gpu": "2× A10G · PCIe 互联",
  "comm_bytes": 1638680,
  "event_count": 5928,
  "note": "时间轴/kernel/PCIe/NCCL 为实测; SM 占用与带宽为 null(torch.profiler 不提供, 需 nsys/ncu).",
  "weights": {
   "tp": 2,
   "dtype": "bfloat16",
   "params_b": 15.59,
   "total_gb": 29.04,
   "per_gpu_gb": 14.52,
   "parts": [
    {
     "key": "embedding",
     "label": "词嵌入 Embedding",
     "total_gb": 0.391,
     "per_gpu_gb": 0.195,
     "pct": 1.3,
     "how": "按词表维度切分到各卡"
    },
    {
     "key": "attention",
     "label": "注意力权重（27 层 MLA）",
     "total_gb": 0.475,
     "per_gpu_gb": 0.237,
     "pct": 1.6,
     "how": "Q/K/V/O 投影，按注意力头切分"
    },
    {
     "key": "dense_ffn",
     "label": "稠密 FFN（前 1 层）",
     "total_gb": 0.125,
     "per_gpu_gb": 0.063,
     "pct": 0.4,
     "how": "gate/up/down 矩阵，按中间维切分"
    },
    {
     "key": "moe_experts",
     "label": "MoE 专家（26 层 × 64+2 专家）",
     "total_gb": 27.657,
     "per_gpu_gb": 13.828,
     "pct": 95.2,
     "how": "每 token 仅激活 6 个专家；权重按中间维切分到各卡"
    },
    {
     "key": "lm_head",
     "label": "输出投影 LM head",
     "total_gb": 0.391,
     "per_gpu_gb": 0.195,
     "pct": 1.3,
     "how": "按词表维度切分到各卡"
    }
   ],
   "measured_per_gpu_gb": 14.81
  },
  "dcgm": {
   "active_gpus": [
    0,
    1
   ],
   "sm_active_pct": 62.2,
   "sm_occupancy_pct": 15.9,
   "dram_active_pct": 58.1,
   "nvlink_active": false,
   "interval_ms": 100
  }
 },
 "breakdown": [
  {
   "kind": "cpu_op",
   "label": "CPU 算子/下发",
   "ms": 69.485,
   "pct": 49.4
  },
  {
   "kind": "moe_expert",
   "label": "MoE 专家计算",
   "ms": 24.503,
   "pct": 17.4
  },
  {
   "kind": "other_kernel",
   "label": "其它 kernel",
   "ms": 23.414,
   "pct": 16.6
  },
  {
   "kind": "gemm",
   "label": "GEMM 矩阵乘",
   "ms": 14.507,
   "pct": 10.3
  },
  {
   "kind": "comm_allreduce",
   "label": "跨卡 All-Reduce",
   "ms": 4.652,
   "pct": 3.3
  },
  {
   "kind": "elementwise",
   "label": "逐元素/归一化",
   "ms": 1.864,
   "pct": 1.3
  },
  {
   "kind": "attention",
   "label": "注意力",
   "ms": 1.4,
   "pct": 1.0
  },
  {
   "kind": "memcpy",
   "label": "PCIe 数据搬运",
   "ms": 0.508,
   "pct": 0.4
  },
  {
   "kind": "comm_other",
   "label": "其它通信",
   "ms": 0.331,
   "pct": 0.2
  }
 ],
 "lanes": [
  "cpu",
  "pcie",
  "gpu",
  "comm"
 ],
 "timeline": [
  {
   "t": 0.0,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 1.299,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 2.598,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.01,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 3.897,
   "cpu": 0.055,
   "pcie": 0.0,
   "gpu": 0.003,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 5.196,
   "cpu": 0.041,
   "pcie": 0.0,
   "gpu": 0.003,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 6.494,
   "cpu": 0.041,
   "pcie": 0.0,
   "gpu": 0.007,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 7.793,
   "cpu": 0.042,
   "pcie": 0.0,
   "gpu": 0.007,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 9.092,
   "cpu": 0.041,
   "pcie": 0.0,
   "gpu": 0.01,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 10.391,
   "cpu": 0.021,
   "pcie": 0.0,
   "gpu": 0.003,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 11.69,
   "cpu": 0.3,
   "pcie": 0.06,
   "gpu": 0.003,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 12.989,
   "cpu": 0.553,
   "pcie": 0.04,
   "gpu": 0.036,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 14.288,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 15.587,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 16.886,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 18.185,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 19.483,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 20.782,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 22.081,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 23.38,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 24.679,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 25.978,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 27.277,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 28.576,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 29.875,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 31.174,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 32.472,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 33.771,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 35.07,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 36.369,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 37.668,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 38.967,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 40.266,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 41.565,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 42.864,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 44.163,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 45.461,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 46.76,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 48.059,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 49.358,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 50.657,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 51.956,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 53.255,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 54.554,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 55.853,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 57.152,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 58.45,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 59.749,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 61.048,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 62.347,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 63.646,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 64.945,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 66.244,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 67.543,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 68.842,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 70.141,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 71.439,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 72.738,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 74.037,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 75.336,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 76.635,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 77.934,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 79.233,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 80.532,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 81.831,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 83.13,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 84.428,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 85.727,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 87.026,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 88.325,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 89.624,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 90.923,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 92.222,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 93.521,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 94.82,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 96.119,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 97.417,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 98.716,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 100.015,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 101.314,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 102.613,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 103.912,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 105.211,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 106.51,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 107.809,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 109.108,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 110.406,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 111.705,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 113.004,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 114.303,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 115.602,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 116.901,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 118.2,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 119.499,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 120.798,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 122.097,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 123.395,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 124.694,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 125.993,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 127.292,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 128.591,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 129.89,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 131.189,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 132.488,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 133.787,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 135.086,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 136.384,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 137.683,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 138.982,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 140.281,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 141.58,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 142.879,
   "cpu": 0.398,
   "pcie": 0.026,
   "gpu": 0.056,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 144.178,
   "cpu": 0.326,
   "pcie": 0.024,
   "gpu": 0.034,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 145.477,
   "cpu": 0.753,
   "pcie": 0.014,
   "gpu": 0.092,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 146.776,
   "cpu": 1.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 148.075,
   "cpu": 1.0,
   "pcie": 0.0,
   "gpu": 0.242,
   "comm": 0.475,
   "gpu_top": "other_kernel"
  },
  {
   "t": 149.373,
   "cpu": 1.0,
   "pcie": 0.001,
   "gpu": 0.538,
   "comm": 0.631,
   "gpu_top": "gemm"
  },
  {
   "t": 150.672,
   "cpu": 1.0,
   "pcie": 0.001,
   "gpu": 1.0,
   "comm": 0.039,
   "gpu_top": "moe_expert"
  },
  {
   "t": 151.971,
   "cpu": 1.0,
   "pcie": 0.002,
   "gpu": 1.0,
   "comm": 0.075,
   "gpu_top": "moe_expert"
  },
  {
   "t": 153.27,
   "cpu": 1.0,
   "pcie": 0.001,
   "gpu": 1.0,
   "comm": 0.063,
   "gpu_top": "moe_expert"
  },
  {
   "t": 154.569,
   "cpu": 1.0,
   "pcie": 0.002,
   "gpu": 1.0,
   "comm": 0.059,
   "gpu_top": "moe_expert"
  },
  {
   "t": 155.868,
   "cpu": 1.0,
   "pcie": 0.002,
   "gpu": 1.0,
   "comm": 0.079,
   "gpu_top": "moe_expert"
  },
  {
   "t": 157.167,
   "cpu": 1.0,
   "pcie": 0.001,
   "gpu": 1.0,
   "comm": 0.06,
   "gpu_top": "moe_expert"
  },
  {
   "t": 158.466,
   "cpu": 1.0,
   "pcie": 0.002,
   "gpu": 1.0,
   "comm": 0.061,
   "gpu_top": "moe_expert"
  },
  {
   "t": 159.765,
   "cpu": 1.0,
   "pcie": 0.002,
   "gpu": 1.0,
   "comm": 0.083,
   "gpu_top": "moe_expert"
  },
  {
   "t": 161.064,
   "cpu": 1.0,
   "pcie": 0.001,
   "gpu": 1.0,
   "comm": 0.072,
   "gpu_top": "moe_expert"
  },
  {
   "t": 162.362,
   "cpu": 1.0,
   "pcie": 0.002,
   "gpu": 1.0,
   "comm": 0.051,
   "gpu_top": "moe_expert"
  },
  {
   "t": 163.661,
   "cpu": 1.0,
   "pcie": 0.015,
   "gpu": 1.0,
   "comm": 0.081,
   "gpu_top": "moe_expert"
  },
  {
   "t": 164.96,
   "cpu": 1.0,
   "pcie": 0.001,
   "gpu": 0.914,
   "comm": 0.067,
   "gpu_top": "moe_expert"
  },
  {
   "t": 166.259,
   "cpu": 1.0,
   "pcie": 0.002,
   "gpu": 0.931,
   "comm": 0.057,
   "gpu_top": "moe_expert"
  },
  {
   "t": 167.558,
   "cpu": 1.0,
   "pcie": 0.002,
   "gpu": 0.898,
   "comm": 0.082,
   "gpu_top": "moe_expert"
  },
  {
   "t": 168.857,
   "cpu": 1.0,
   "pcie": 0.001,
   "gpu": 0.948,
   "comm": 0.042,
   "gpu_top": "moe_expert"
  },
  {
   "t": 170.156,
   "cpu": 1.0,
   "pcie": 0.001,
   "gpu": 0.923,
   "comm": 0.061,
   "gpu_top": "moe_expert"
  },
  {
   "t": 171.455,
   "cpu": 1.0,
   "pcie": 0.001,
   "gpu": 0.093,
   "comm": 0.06,
   "gpu_top": "gemm"
  },
  {
   "t": 172.754,
   "cpu": 1.0,
   "pcie": 0.0,
   "gpu": 0.0,
   "comm": 0.0,
   "gpu_top": null
  },
  {
   "t": 174.053,
   "cpu": 1.0,
   "pcie": 0.0,
   "gpu": 0.479,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 175.351,
   "cpu": 1.0,
   "pcie": 0.0,
   "gpu": 0.865,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 176.65,
   "cpu": 1.0,
   "pcie": 0.015,
   "gpu": 0.099,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 177.949,
   "cpu": 1.0,
   "pcie": 0.01,
   "gpu": 0.454,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 179.248,
   "cpu": 0.049,
   "pcie": 0.0,
   "gpu": 0.003,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 180.547,
   "cpu": 0.326,
   "pcie": 0.017,
   "gpu": 0.066,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 181.846,
   "cpu": 0.164,
   "pcie": 0.0,
   "gpu": 0.107,
   "comm": 0.0,
   "gpu_top": "other_kernel"
  },
  {
   "t": 183.145,
   "cpu": 0.009,
   "pcie": 0.0,
   "gpu": 1.0,
   "comm": 0.095,
   "gpu_top": "other_kernel"
  },
  {
   "t": 184.444,
   "cpu": 0.99,
   "pcie": 0.026,
   "gpu": 1.0,
   "comm": 0.083,
   "gpu_top": "moe_expert"
  },
  {
   "t": 185.743,
   "cpu": 0.27,
   "pcie": 0.012,
   "gpu": 1.0,
   "comm": 0.078,
   "gpu_top": "moe_expert"
  },
  {
   "t": 187.042,
   "cpu": 0.355,
   "pcie": 0.014,
   "gpu": 1.0,
   "comm": 0.077,
   "gpu_top": "moe_expert"
  },
  {
   "t": 188.34,
   "cpu": 0.158,
   "pcie": 0.002,
   "gpu": 1.0,
   "comm": 0.086,
   "gpu_top": "moe_expert"
  },
  {
   "t": 189.639,
   "cpu": 0.593,
   "pcie": 0.017,
   "gpu": 1.0,
   "comm": 0.063,
   "gpu_top": "other_kernel"
  },
  {
   "t": 190.938,
   "cpu": 0.434,
   "pcie": 0.012,
   "gpu": 0.901,
   "comm": 0.123,
   "gpu_top": "gemm"
  },
  {
   "t": 192.237,
   "cpu": 0.445,
   "pcie": 0.014,
   "gpu": 1.0,
   "comm": 0.088,
   "gpu_top": "moe_expert"
  },
  {
   "t": 193.536,
   "cpu": 0.017,
   "pcie": 0.0,
   "gpu": 1.0,
   "comm": 0.078,
   "gpu_top": "other_kernel"
  },
  {
   "t": 194.835,
   "cpu": 0.874,
   "pcie": 0.024,
   "gpu": 1.0,
   "comm": 0.077,
   "gpu_top": "moe_expert"
  },
  {
   "t": 196.134,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 1.0,
   "comm": 0.087,
   "gpu_top": "other_kernel"
  },
  {
   "t": 197.433,
   "cpu": 0.0,
   "pcie": 0.001,
   "gpu": 1.0,
   "comm": 0.085,
   "gpu_top": "other_kernel"
  },
  {
   "t": 198.732,
   "cpu": 0.004,
   "pcie": 0.003,
   "gpu": 1.0,
   "comm": 0.112,
   "gpu_top": "other_kernel"
  },
  {
   "t": 200.031,
   "cpu": 0.238,
   "pcie": 0.014,
   "gpu": 1.0,
   "comm": 0.083,
   "gpu_top": "moe_expert"
  },
  {
   "t": 201.329,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 1.0,
   "comm": 0.087,
   "gpu_top": "other_kernel"
  },
  {
   "t": 202.628,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 1.0,
   "comm": 0.076,
   "gpu_top": "other_kernel"
  },
  {
   "t": 203.927,
   "cpu": 0.0,
   "pcie": 0.0,
   "gpu": 1.0,
   "comm": 0.082,
   "gpu_top": "other_kernel"
  },
  {
   "t": 205.226,
   "cpu": 0.0,
   "pcie": 0.001,
   "gpu": 1.0,
   "comm": 0.082,
   "gpu_top": "other_kernel"
  },
  {
   "t": 206.525,
   "cpu": 0.0,
   "pcie": 0.003,
   "gpu": 1.0,
   "comm": 0.097,
   "gpu_top": "other_kernel"
  }
 ],
 "phases": [
  {
   "macro": "host",
   "group": "tok0",
   "group_label": "Prefill 阶段（一次处理整个输入提示）",
   "title": "主机：准备输入 + 下发",
   "desc": "CPU 把整段输入提示 tokenize、组织成张量，经 PCIe 搬进 GPU 显存并下发 kernel。这是一次推理的开场，GPU 此时基本空闲。",
   "lanes": [
    "cpu",
    "pcie"
   ],
   "has_moe": false,
   "has_comm": false,
   "t0": 142.879,
   "t1": 148.075,
   "ms": 5.196,
   "b0": 110,
   "b1": 113,
   "avg": {
    "cpu": 0.619,
    "pcie": 0.016,
    "gpu": 0.045,
    "comm": 0.0
   },
   "ops": [
    {
     "op": "逐元素运算",
     "count": 21,
     "ms": 0.293,
     "desc": "加/乘/拷贝/索引等向量化小算子"
    },
    {
     "op": "数据搬运 (PCIe/显存)",
     "count": 16,
     "ms": 0.084,
     "desc": "主机↔显存或显存内拷贝"
    },
    {
     "op": "注意力计算",
     "count": 1,
     "ms": 0.002,
     "desc": "Q·Kᵀ 打分、softmax、加权 V（MLA 潜在注意力）"
    }
   ],
   "n_layers": 1,
   "layer_flow": []
  },
  {
   "macro": "kernel",
   "group": "tok0",
   "group_label": "Prefill 阶段（一次处理整个输入提示）",
   "title": "Prefill：GPU 逐层计算（含 MoE）",
   "desc": "一次性把整个输入提示的所有 token 喂过全部 GEMM 矩阵乘 / 注意力、MoE 专家计算、跨卡 All-Reduce。Prefill 并行处理很多 token，算力利用率高；MoE 层里每个 token 经 router 选专家、张量并行分片靠 All-Reduce 合并。算完顺便建立 KV cache 供 Decode 复用。",
   "lanes": [
    "gpu",
    "comm"
   ],
   "has_moe": true,
   "has_comm": true,
   "t0": 148.075,
   "t1": 171.455,
   "ms": 23.38,
   "b0": 114,
   "b1": 131,
   "avg": {
    "cpu": 1.0,
    "pcie": 0.002,
    "gpu": 0.911,
    "comm": 0.119
   },
   "ops": [
    {
     "op": "逐元素运算",
     "count": 368,
     "ms": 16.769,
     "desc": "加/乘/拷贝/索引等向量化小算子"
    },
    {
     "op": "MoE 专家计算",
     "count": 52,
     "ms": 13.73,
     "desc": "被选中的专家对各自分到的 token 做前馈 GEMM"
    },
    {
     "op": "注意力计算",
     "count": 27,
     "ms": 10.159,
     "desc": "Q·Kᵀ 打分、softmax、加权 V（MLA 潜在注意力）"
    },
    {
     "op": "矩阵乘法 GEMM",
     "count": 296,
     "ms": 3.958,
     "desc": "QKV / 输出 / 词表投影等稠密矩阵乘"
    },
    {
     "op": "跨卡 All-Reduce",
     "count": 55,
     "ms": 2.777,
     "desc": "张量并行：把分片结果在 GPU 间求和合并"
    },
    {
     "op": "MoE 路由 (选专家)",
     "count": 104,
     "ms": 0.34,
     "desc": "router 给每个 token 打分，选 top-k 个专家并按专家分组"
    },
    {
     "op": "层归一化 (RMSNorm)",
     "count": 82,
     "ms": 0.2,
     "desc": "每个子层前对激活做归一化，稳定数值"
    },
    {
     "op": "Softmax",
     "count": 28,
     "ms": 0.179,
     "desc": "注意力分数归一化为概率"
    },
    {
     "op": "激活函数 (SwiGLU)",
     "count": 53,
     "ms": 0.098,
     "desc": "前馈网络的门控激活"
    },
    {
     "op": "数据搬运 (PCIe/显存)",
     "count": 27,
     "ms": 0.048,
     "desc": "主机↔显存或显存内拷贝"
    }
   ],
   "n_layers": 27,
   "layer_flow": [
    {
     "name": "① 层归一化",
     "desc": "RMSNorm：对输入激活归一化"
    },
    {
     "name": "② QKV 投影",
     "desc": "GEMM：算出 Query/Key/Value"
    },
    {
     "name": "③ 注意力",
     "desc": "Q·Kᵀ 打分 → softmax → 加权 V（MLA 潜在注意力）"
    },
    {
     "name": "④ 注意力输出 + All-Reduce",
     "desc": "输出投影 GEMM，并把张量并行分片在卡间求和"
    },
    {
     "name": "⑤ 层归一化",
     "desc": "RMSNorm：进入 MoE 前再归一化"
    },
    {
     "name": "⑥ MoE 路由",
     "desc": "router 给每个 token 打分，选 top-k 个专家并按专家分组"
    },
    {
     "name": "⑦ 专家前馈",
     "desc": "被选中的专家对各自分到的 token 做 GEMM + SwiGLU 激活"
    },
    {
     "name": "⑧ MoE 输出 + All-Reduce",
     "desc": "合并专家输出，并把分片在卡间求和"
    }
   ]
  },
  {
   "macro": "host",
   "group": "decode",
   "group_label": "Decode 阶段（逐个生成后续 token）",
   "title": "主机：采样 + 下一步下发",
   "desc": "CPU 拿到上一个 token 的 logits 做采样得到新 token，再把它作为输入下发下一轮。Decode 每生成一个 token 都要这样和 GPU 来回一次。",
   "lanes": [
    "cpu",
    "pcie"
   ],
   "has_moe": false,
   "has_comm": false,
   "t0": 180.547,
   "t1": 183.145,
   "ms": 2.598,
   "b0": 139,
   "b1": 140,
   "avg": {
    "cpu": 0.245,
    "pcie": 0.009,
    "gpu": 0.086,
    "comm": 0.0
   },
   "ops": [
    {
     "op": "逐元素运算",
     "count": 22,
     "ms": 0.283,
     "desc": "加/乘/拷贝/索引等向量化小算子"
    },
    {
     "op": "数据搬运 (PCIe/显存)",
     "count": 2,
     "ms": 0.022,
     "desc": "主机↔显存或显存内拷贝"
    },
    {
     "op": "注意力计算",
     "count": 1,
     "ms": 0.002,
     "desc": "Q·Kᵀ 打分、softmax、加权 V（MLA 潜在注意力）"
    }
   ],
   "n_layers": 1,
   "layer_flow": []
  },
  {
   "macro": "kernel",
   "group": "decode",
   "group_label": "Decode 阶段（逐个生成后续 token）",
   "title": "Decode：GPU 逐层计算（含 MoE）",
   "desc": "只为「1 个」新 token 走完全部层。注意力直接复用 Prefill 建好的 KV cache，所以注意力很轻；但权重仍要从 HBM 全量读一遍，于是 Decode 往往是访存受限、算力利用率低于 Prefill。每个新 token 都重复一次本阶段。",
   "lanes": [
    "gpu",
    "comm"
   ],
   "has_moe": true,
   "has_comm": true,
   "t0": 183.145,
   "t1": 207.824,
   "ms": 24.679,
   "b0": 141,
   "b1": 159,
   "avg": {
    "cpu": 0.231,
    "pcie": 0.008,
    "gpu": 0.995,
    "comm": 0.086
   },
   "ops": [
    {
     "op": "MoE 专家计算",
     "count": 156,
     "ms": 9.035,
     "desc": "被选中的专家对各自分到的 token 做前馈 GEMM"
    },
    {
     "op": "矩阵乘法 GEMM",
     "count": 165,
     "ms": 4.513,
     "desc": "QKV / 输出 / 词表投影等稠密矩阵乘"
    },
    {
     "op": "逐元素运算",
     "count": 613,
     "ms": 3.485,
     "desc": "加/乘/拷贝/索引等向量化小算子"
    },
    {
     "op": "跨卡 All-Reduce",
     "count": 168,
     "ms": 2.128,
     "desc": "张量并行：把分片结果在 GPU 间求和合并"
    },
    {
     "op": "MoE 路由 (选专家)",
     "count": 312,
     "ms": 1.398,
     "desc": "router 给每个 token 打分，选 top-k 个专家并按专家分组"
    },
    {
     "op": "Softmax",
     "count": 165,
     "ms": 0.709,
     "desc": "注意力分数归一化为概率"
    },
    {
     "op": "层归一化 (RMSNorm)",
     "count": 246,
     "ms": 0.558,
     "desc": "每个子层前对激活做归一化，稳定数值"
    },
    {
     "op": "激活函数 (SwiGLU)",
     "count": 159,
     "ms": 0.335,
     "desc": "前馈网络的门控激活"
    },
    {
     "op": "数据搬运 (PCIe/显存)",
     "count": 26,
     "ms": 0.189,
     "desc": "主机↔显存或显存内拷贝"
    },
    {
     "op": "注意力计算",
     "count": 2,
     "ms": 0.004,
     "desc": "Q·Kᵀ 打分、softmax、加权 V（MLA 潜在注意力）"
    }
   ],
   "n_layers": 2,
   "layer_flow": [
    {
     "name": "① 层归一化",
     "desc": "RMSNorm：对输入激活归一化"
    },
    {
     "name": "② QKV 投影",
     "desc": "GEMM：算出 Query/Key/Value"
    },
    {
     "name": "③ 注意力",
     "desc": "Q·Kᵀ 打分 → softmax → 加权 V（MLA 潜在注意力）"
    },
    {
     "name": "④ 注意力输出 + All-Reduce",
     "desc": "输出投影 GEMM，并把张量并行分片在卡间求和"
    },
    {
     "name": "⑤ 层归一化",
     "desc": "RMSNorm：进入 MoE 前再归一化"
    },
    {
     "name": "⑥ MoE 路由",
     "desc": "router 给每个 token 打分，选 top-k 个专家并按专家分组"
    },
    {
     "name": "⑦ 专家前馈",
     "desc": "被选中的专家对各自分到的 token 做 GEMM + SwiGLU 激活"
    },
    {
     "name": "⑧ MoE 输出 + All-Reduce",
     "desc": "合并专家输出，并把分片在卡间求和"
    }
   ]
  }
 ]
};

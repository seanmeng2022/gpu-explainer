#!/usr/bin/env bash
# =============================================================================
# setup-sglang.sh — 在 GPU 实例上安装 SGLang，部署 DeepSeek-V2-Lite（2 卡 TP），
#                   并准备好采集推理 trace。在实例上运行（ubuntu 用户）。
# =============================================================================
set -euo pipefail

MODEL="${MODEL:-deepseek-ai/DeepSeek-V2-Lite-Chat}"
TP="${TP:-2}"                       # 张量并行卡数；g5.12xlarge 有 4 卡，先用 2 验证
PORT="${PORT:-30000}"
PROFILE_DIR="${PROFILE_DIR:-$HOME/sglang/profile_log}"

say(){ printf '\033[1;32m[setup]\033[0m %s\n' "$*"; }

say "GPU 信息:"; nvidia-smi --query-gpu=index,name,memory.total --format=csv || true

# 这台 DLAMI 没有 conda，但自带 /opt/pytorch venv（Python 3.12 + Torch 2.7 cu128）。
# 基于系统装一个独立 venv 给 SGLang，复用已有 CUDA torch。
VENV="$HOME/sglang-venv"
PYBASE="/opt/pytorch/bin/python"
say "创建独立 venv: $VENV（基于 $PYBASE）..."
sudo apt-get update -qq && sudo apt-get install -y -qq python3.12-venv >/dev/null 2>&1 || true
"$PYBASE" -m venv --system-site-packages "$VENV"   # 继承 /opt/pytorch 的 torch，省下载
# shellcheck disable=SC1091
source "$VENV/bin/activate"
ACTIVATE="source $VENV/bin/activate"

say "安装 SGLang（含所有推理依赖）..."
pip install --upgrade pip >/dev/null
pip install "sglang[all]"

mkdir -p "$PROFILE_DIR"

# 把启动/采集命令写成小脚本，方便反复用
cat > "$HOME/run_server.sh" <<EOF
#!/usr/bin/env bash
set -e
source "$VENV/bin/activate"
export SGLANG_TORCH_PROFILER_DIR="$PROFILE_DIR"
export SGLANG_PROFILE_RECORD_SHAPES=True
echo "[server] 启动 $MODEL  TP=$TP  端口=$PORT"
echo "[server] trace 将写入 $PROFILE_DIR"
python -m sglang.launch_server \\
  --model-path "$MODEL" \\
  --tp $TP \\
  --trust-remote-code \\
  --host 0.0.0.0 --port $PORT
EOF
chmod +x "$HOME/run_server.sh"

cat > "$HOME/capture_trace.sh" <<EOF
#!/usr/bin/env bash
# 抓一次推理 trace：开 profiler → 发请求 → 等落盘
set -e
PORT=$PORT
echo "[capture] start_profile (num_steps=5)..."
curl -s -X POST -H 'Content-Type: application/json' \\
  "http://127.0.0.1:\$PORT/start_profile" -d '{"num_steps":5}' ; echo
echo "[capture] 发送推理请求..."
curl -s -X POST -H 'Content-Type: application/json' \\
  "http://127.0.0.1:\$PORT/generate" \\
  -d '{"text":"The quick brown fox jumps over","sampling_params":{"max_new_tokens":8}}' ; echo
echo "[capture] 等待 trace 落盘（停止 profiling 可能需数秒~数十秒）..."
sleep 8
echo "[capture] trace 文件:"
ls -lh "$PROFILE_DIR"/ 2>/dev/null || echo "  (还没出现，稍等再 ls $PROFILE_DIR)"
EOF
chmod +x "$HOME/capture_trace.sh"

cat <<EOF

\033[1;32m===================== SGLang 安装完成 =====================\033[0m
模型: $MODEL   TP=$TP   端口=$PORT
trace 目录: $PROFILE_DIR

用法（两个终端）:
  # 终端 A — 启动服务（首次会下载模型，需几分钟）
  ~/run_server.sh

  # 终端 B — 等服务日志出现 "The server is fired up" 后，抓 trace
  ~/capture_trace.sh

trace 是 Chrome Trace 格式(*.trace.json.gz)。下载到本地后用转换脚本:
  python tools/trace_to_steps.py <trace文件> -o web_data.json
============================================================
EOF

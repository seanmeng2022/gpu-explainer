#!/usr/bin/env bash
# =============================================================================
# deploy.sh — 在 AWS 上拉起一台 GPU 开发机，用于 SGLang 部署 MoE 模型并采集推理 trace
#
# 用法:
#   ./deploy.sh            # 默认 g5.12xlarge（4×A10G）@ us-west-2，跑通流程用
#   INSTANCE_TYPE=p4d.24xlarge ./deploy.sh   # 后续出 NVLink 正式素材时
#
# 设计:
#   - 用本地 AWS 凭证（aws sts get-caller-identity 能通即可）
#   - 幂等: 资源用固定名字/Tag，重复跑会复用已有的，不会重复创建
#   - 只对你的公网 IP 开放 SSH(22) 和 SGLang(30000)
#   - 所有资源打 Project=gpu-explainer 标签，teardown.sh 据此清理
# =============================================================================
set -euo pipefail

# ---------- 可调参数 ----------
REGION="${REGION:-us-west-2}"
INSTANCE_TYPE="${INSTANCE_TYPE:-g5.12xlarge}"
# 候选机型(按顺序尝试，应对某机型容量不足)。都是 ≥2 卡、能跑 DeepSeek-V2-Lite TP=2。
INSTANCE_CANDIDATES="${INSTANCE_CANDIDATES:-$INSTANCE_TYPE g5.24xlarge g5.48xlarge g6e.12xlarge}"
PROJECT="gpu-explainer"
KEY_NAME="${KEY_NAME:-${PROJECT}-key}"
SG_NAME="${SG_NAME:-${PROJECT}-sg}"
DISK_GB="${DISK_GB:-300}"            # DeepSeek-V2-Lite + 镜像，留足空间
# Deep Learning AMI: PyTorch 2.7 / Ubuntu 22.04（含 NVIDIA 驱动 + CUDA）
AMI_SSM="/aws/service/deeplearning/ami/x86_64/oss-nvidia-driver-gpu-pytorch-2.7-ubuntu-22.04/latest/ami-id"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEY_FILE="${SCRIPT_DIR}/${KEY_NAME}.pem"

say(){ printf '\033[1;32m[deploy]\033[0m %s\n' "$*"; }
warn(){ printf '\033[1;33m[deploy]\033[0m %s\n' "$*"; }
die(){ printf '\033[1;31m[deploy] %s\033[0m\n' "$*" >&2; exit 1; }

# ---------- 0. 前置检查 ----------
command -v aws >/dev/null || die "未找到 aws CLI"
aws sts get-caller-identity >/dev/null 2>&1 || die "AWS 凭证不可用，先配置好本地 aksk"
MY_IP="$(curl -s checkip.amazonaws.com || true)"
[ -n "$MY_IP" ] || die "拿不到本机公网 IP"
say "Region=$REGION  实例=$INSTANCE_TYPE  允许来源 IP=$MY_IP/32"

aws_ec2(){ aws ec2 "$@" --region "$REGION"; }

# ---------- 1. 解析 AMI ----------
say "解析 Deep Learning AMI..."
AMI_ID="$(aws ssm get-parameters --region "$REGION" --names "$AMI_SSM" \
  --query 'Parameters[0].Value' --output text)"
[ "$AMI_ID" != "None" ] && [ -n "$AMI_ID" ] || die "AMI 解析失败"
say "AMI=$AMI_ID"

# ---------- 2. 密钥对 ----------
if aws_ec2 describe-key-pairs --key-names "$KEY_NAME" >/dev/null 2>&1; then
  say "密钥对已存在: $KEY_NAME"
  [ -f "$KEY_FILE" ] || warn "本地缺少 $KEY_FILE —— 若无法 SSH，请先删除密钥对再重跑"
else
  say "创建密钥对 $KEY_NAME → $KEY_FILE"
  aws_ec2 create-key-pair --key-name "$KEY_NAME" \
    --query 'KeyMaterial' --output text > "$KEY_FILE"
  chmod 400 "$KEY_FILE"
fi

# ---------- 3. 安全组 ----------
VPC_ID="$(aws_ec2 describe-vpcs --filters Name=isDefault,Values=true \
  --query 'Vpcs[0].VpcId' --output text)"
[ "$VPC_ID" != "None" ] || die "找不到默认 VPC"

SG_ID="$(aws_ec2 describe-security-groups \
  --filters Name=group-name,Values="$SG_NAME" Name=vpc-id,Values="$VPC_ID" \
  --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo None)"

if [ "$SG_ID" = "None" ] || [ -z "$SG_ID" ]; then
  say "创建安全组 $SG_NAME"
  SG_ID="$(aws_ec2 create-security-group --group-name "$SG_NAME" \
    --description "GPU Explainer dev box" --vpc-id "$VPC_ID" \
    --tag-specifications "ResourceType=security-group,Tags=[{Key=Project,Value=$PROJECT}]" \
    --query 'GroupId' --output text)"
fi
say "安全组 SG_ID=$SG_ID"

# 放行 SSH 与 SGLang 端口给本机 IP（已存在则忽略报错）
for port in 22 30000; do
  aws_ec2 authorize-security-group-ingress --group-id "$SG_ID" \
    --protocol tcp --port "$port" --cidr "${MY_IP}/32" >/dev/null 2>&1 \
    && say "放行端口 $port ← ${MY_IP}/32" || true
done

# ---------- 4. 复用或创建实例 ----------
EXIST="$(aws_ec2 describe-instances \
  --filters Name=tag:Project,Values=$PROJECT \
            "Name=instance-state-name,Values=pending,running,stopped" \
  --query 'Reservations[].Instances[0].InstanceId' --output text 2>/dev/null || true)"

if [ -n "$EXIST" ] && [ "$EXIST" != "None" ]; then
  INSTANCE_ID="$EXIST"
  warn "已存在实例 $INSTANCE_ID（复用，不新建）。如需换机型请先 ./teardown.sh"
else
  # 所有 AZ 子网（应对单 AZ 容量不足），逐机型 × 逐 AZ 尝试（兼容 bash 3.2，不用 mapfile）
  SUBNETS="$(aws_ec2 describe-subnets --filters Name=vpc-id,Values="$VPC_ID" \
      --query 'Subnets[].[AvailabilityZone,SubnetId]' --output text \
      | awk '!seen[$1]++ {print $2"@"$1}')"   # 每个 AZ 取一个子网
  INSTANCE_ID=""
  for itype in $INSTANCE_CANDIDATES; do
    for entry in $SUBNETS; do
      subnet="${entry%@*}"; az="${entry#*@}"
      say "尝试 $itype @ $az ($subnet) ..."
      if OUT="$(aws_ec2 run-instances \
        --image-id "$AMI_ID" --instance-type "$itype" \
        --key-name "$KEY_NAME" --security-group-ids "$SG_ID" --subnet-id "$subnet" \
        --block-device-mappings "DeviceName=/dev/sda1,Ebs={VolumeSize=${DISK_GB},VolumeType=gp3,DeleteOnTermination=true}" \
        --tag-specifications \
          "ResourceType=instance,Tags=[{Key=Project,Value=$PROJECT},{Key=Name,Value=$PROJECT}]" \
        --query 'Instances[0].InstanceId' --output text 2>&1)"; then
        INSTANCE_ID="$OUT"; INSTANCE_TYPE="$itype"
        say "✓ 拿到容量: $itype @ $az"
        break
      else
        REASON="$(echo "$OUT" | grep -o 'InsufficientInstanceCapacity\|InstanceLimitExceeded\|Unsupported' | head -1)"
        warn "  不可用: ${REASON:-其它错误}"
      fi
    done
    [ -n "$INSTANCE_ID" ] && break
  done
  [ -n "$INSTANCE_ID" ] || die "所有候选机型 × 所有 AZ 都没有容量。可稍后重试，或设 REGION=us-east-1 重跑，或换 INSTANCE_CANDIDATES。"
fi
say "实例 ID=$INSTANCE_ID，等待 running..."
aws_ec2 wait instance-running --instance-ids "$INSTANCE_ID"

PUB_IP="$(aws_ec2 describe-instances --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"
say "公网 IP=$PUB_IP"

# 保存连接信息
cat > "${SCRIPT_DIR}/.instance.env" <<EOF
REGION=$REGION
INSTANCE_ID=$INSTANCE_ID
PUBLIC_IP=$PUB_IP
KEY_FILE=$KEY_FILE
INSTANCE_TYPE=$INSTANCE_TYPE
EOF

cat <<EOF

\033[1;32m========================= 部署完成 =========================\033[0m
实例:     $INSTANCE_ID ($INSTANCE_TYPE)  @ $REGION
公网 IP:  $PUB_IP
SSH:      ssh -i "$KEY_FILE" ubuntu@$PUB_IP

下一步（在实例上装 SGLang 并起服务）:
  scp -i "$KEY_FILE" "${SCRIPT_DIR}/setup-sglang.sh" ubuntu@$PUB_IP:~/
  ssh -i "$KEY_FILE" ubuntu@$PUB_IP 'bash ~/setup-sglang.sh'

⚠️  $INSTANCE_TYPE 按小时计费，不用时务必跑 ./teardown.sh 销毁！
============================================================
EOF

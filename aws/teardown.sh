#!/usr/bin/env bash
# =============================================================================
# teardown.sh — 销毁 deploy.sh 创建的所有资源（按 Project=gpu-explainer 标签）
#   默认保留密钥对和安全组（下次复用）；加 --all 连它们一起删。
# =============================================================================
set -euo pipefail

REGION="${REGION:-us-west-2}"
PROJECT="gpu-explainer"
KEY_NAME="${KEY_NAME:-${PROJECT}-key}"
SG_NAME="${SG_NAME:-${PROJECT}-sg}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DELETE_ALL=0
[ "${1:-}" = "--all" ] && DELETE_ALL=1

say(){ printf '\033[1;36m[teardown]\033[0m %s\n' "$*"; }
aws_ec2(){ aws ec2 "$@" --region "$REGION"; }

# 终止实例
IDS="$(aws_ec2 describe-instances \
  --filters Name=tag:Project,Values=$PROJECT \
            "Name=instance-state-name,Values=pending,running,stopping,stopped" \
  --query 'Reservations[].Instances[].InstanceId' --output text || true)"
if [ -n "$IDS" ] && [ "$IDS" != "None" ]; then
  say "终止实例: $IDS"
  aws_ec2 terminate-instances --instance-ids $IDS >/dev/null
  say "等待实例完全终止（EBS 卷一并删除）..."
  aws_ec2 wait instance-terminated --instance-ids $IDS
  say "实例已终止"
else
  say "没有运行中的实例"
fi
rm -f "${SCRIPT_DIR}/.instance.env"

if [ "$DELETE_ALL" = "1" ]; then
  say "--all: 删除安全组与密钥对"
  SG_ID="$(aws_ec2 describe-security-groups --filters Name=group-name,Values="$SG_NAME" \
    --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || echo None)"
  [ "$SG_ID" != "None" ] && [ -n "$SG_ID" ] && aws_ec2 delete-security-group --group-id "$SG_ID" && say "删除安全组 $SG_ID" || true
  aws_ec2 delete-key-pair --key-name "$KEY_NAME" 2>/dev/null && say "删除密钥对 $KEY_NAME" || true
  rm -f "${SCRIPT_DIR}/${KEY_NAME}.pem"
else
  say "保留安全组/密钥对（下次复用）。彻底清理请加: ./teardown.sh --all"
fi
say "完成 ✅"

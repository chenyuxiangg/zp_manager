#!/bin/bash
#
# Zpersion 后端开发启动脚本
# 作用：source .env 后启动 flask run
#
# ⚠️ 安全约定：
#   1. 任何 MAIL_*/DATABASE_URL/SECRET_KEY/JWT_SECRET_KEY 绝不能写在本文件中
#   2. 所有敏感配置从 backend/.env 读取（参考 backend/.env.example）
#   3. .env 文件不进版本库（已在 .gitignore 排除）
#   4. 部署时由运维用 vault / k8s Secret / docker secret 注入环境变量
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 加载 .env（如存在）；不存在则依赖外部注入的环境变量
if [ -f .env ]; then
  set -a  # 自动 export 所有变量
  # shellcheck disable=SC1091
  source .env
  set +a
else
  echo "[start.sh] WARNING: backend/.env not found; relying on OS env vars" >&2
fi

# 必填项校验（fail-fast，不静默回退到硬编码）
: "${FLASK_APP:=app.py}"
: "${DATABASE_URL:?[start.sh] FATAL: DATABASE_URL is required (set in .env)}"
: "${SECRET_KEY:?[start.sh] FATAL: SECRET_KEY is required (set in .env)}"
: "${JWT_SECRET_KEY:?[start.sh] FATAL: JWT_SECRET_KEY is required (set in .env)}"

# 邮件配置可选（密码重置需要；缺失时该功能降级为日志输出）
MAIL_SERVER="${MAIL_SERVER:-}"
MAIL_PORT="${MAIL_PORT:-587}"
MAIL_USE_TLS="${MAIL_USE_TLS:-true}"
MAIL_USERNAME="${MAIL_USERNAME:-}"
MAIL_PASSWORD="${MAIL_PASSWORD:-}"
MAIL_DEFAULT_SENDER="${MAIL_DEFAULT_SENDER:-noreply@example.com}"

export FLASK_APP DATABASE_URL SECRET_KEY JWT_SECRET_KEY
export MAIL_SERVER MAIL_PORT MAIL_USE_TLS MAIL_USERNAME MAIL_PASSWORD MAIL_DEFAULT_SENDER

# ──────────────────────────────────────────────────────────────────────
# B0319: 启动前自动检测 + 跑 alembic 升级（开发期体验）
# - 全新 DB → `flask db upgrade` 一次性创建所有表（避免 500）
# - 已迁移 DB → `flask db upgrade` 幂等 no-op（不会回滚或破坏）
# - 生产环境如需手动控制：设 `ZP_SKIP_AUTO_UPGRADE=1` 跳过
# - release.sh 应在生产部署前手动调用 `flask db upgrade`（由 release 流水线控制）
# ──────────────────────────────────────────────────────────────────────
if [ "${ZP_SKIP_AUTO_UPGRADE:-0}" != "1" ]; then
  echo "[start.sh] Running alembic upgrade (B0319: auto-detect & upgrade)..."
  if ! flask db upgrade >> ../logs/backend.log 2>&1; then
    echo "[start.sh] WARNING: alembic upgrade failed; trying stamp+upgrade fallback" >&2
    # 退化策略：若 alembic_version 表缺失，先 stamp 到 baseline 再 upgrade
    flask db stamp head >> ../logs/backend.log 2>&1 || true
    flask db upgrade >> ../logs/backend.log 2>&1 || {
      echo "[start.sh] FATAL: alembic upgrade failed even after stamp fallback. Start manually: 'flask db upgrade'" >&2
      exit 1
    }
  fi
  echo "[start.sh] alembic upgrade OK"
else
  echo "[start.sh] ZP_SKIP_AUTO_UPGRADE=1, skipping auto upgrade (production mode)"
fi

# 启动
mkdir -p ../logs
flask run -h 0.0.0.0 -p 5000 >> ../logs/backend.log 2>&1

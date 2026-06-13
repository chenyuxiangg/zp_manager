#!/bin/bash
#
# Zpersion 生产部署脚本
#
# 用法：
#   ./deploy.sh                          # 自动取脚本所在目录作为项目根
#   PROJECT_DIR=/path/to/release ./deploy.sh
#   ./deploy.sh /path/to/release
#
# 前置条件：
#   - backend/.env 已按 .env.example 填好（DATABASE_URL / SECRET_KEY / JWT_SECRET_KEY 必填）
#   - 系统已装 python3 / node / npm / mysql / nginx / sudo
#
# 本脚本会做：
#   [1] 安装/更新后端依赖（pip install -r requirements.txt，含 gunicorn）
#   [2] 构建前端（npm install + npm run build）
#   [3] 渲染 nginx 配置（替换 __PROJECT_DIR__ → 真实路径），重载 nginx
#   [4] 启动 gunicorn（factory 模式 app:create_app()，4 worker + 2 thread）
#
set -e

# ---- 0. 确定项目根（脚本所在目录优先，可被参数/环境变量覆盖）----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="${1:-${PROJECT_DIR:-$SCRIPT_DIR}}"

for d in backend frontend nginx; do
    if [ ! -d "$PROJECT_DIR/$d" ]; then
        echo "[FATAL] $PROJECT_DIR/$d 不存在；PROJECT_DIR 似乎不是 zpersion 项目根" >&2
        exit 1
    fi
done

NGINX_TEMPLATE="$PROJECT_DIR/nginx/zpersion.conf"
NGINX_DST_AVAIL="/etc/nginx/sites-available/zpersion"
NGINX_DST_ENA="/etc/nginx/sites-enabled/zpersion"
OLD_PHP_CONF="/etc/nginx/sites-enabled/project.conf"

echo "=== 部署 Zpersion（项目根：$PROJECT_DIR） ==="

# ---- 1. 后端依赖 ----
echo "[1/4] 安装后端依赖..."
cd "$PROJECT_DIR/backend"
[ -d venv ] || python3 -m venv venv
# shellcheck disable=SC1091
source venv/bin/activate
pip install -q --upgrade pip
pip install -q -r requirements.txt

# ---- 2. 前端构建 ----
echo "[2/4] 构建前端..."
cd "$PROJECT_DIR/frontend"
npm install --no-audit --no-fund
npm run build

# ---- 3. nginx 配置（替换占位符 → 应用 → 重载）----
echo "[3/4] 配置 nginx..."
TMP_CONF="$(mktemp)"
trap 'rm -f "$TMP_CONF"' EXIT
sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$NGINX_TEMPLATE" > "$TMP_CONF"
sudo cp -f "$TMP_CONF" "$NGINX_DST_AVAIL"
sudo chown root:root "$NGINX_DST_AVAIL"
sudo chmod 644 "$NGINX_DST_AVAIL"
sudo ln -sf "$NGINX_DST_AVAIL" "$NGINX_DST_ENA"
if [ -e "$OLD_PHP_CONF" ]; then
    sudo rm -f "$OLD_PHP_CONF"
    echo "    已禁用旧 PHP 站点 $OLD_PHP_CONF"
fi
sudo nginx -t
sudo systemctl reload nginx

# ---- 4. 启动 gunicorn（factory 模式）----
echo "[4/4] 启动 gunicorn（app:create_app()，4 worker × 2 thread）..."
cd "$PROJECT_DIR/backend"
mkdir -p "$PROJECT_DIR/logs"

# 加载 backend/.env（gunicorn 进程需要 DATABASE_URL / SECRET_KEY / JWT_SECRET_KEY）
if [ ! -f .env ]; then
    echo "[FATAL] backend/.env 不存在；请按 .env.example 模板创建" >&2
    exit 1
fi
set -a
# shellcheck disable=SC1091
source .env
set +a
: "${FLASK_APP:=app.py}"
: "${DATABASE_URL:?FATAL: DATABASE_URL 未设置（请检查 backend/.env）}"
: "${SECRET_KEY:?FATAL: SECRET_KEY 未设置（请检查 backend/.env）}"
: "${JWT_SECRET_KEY:?FATAL: JWT_SECRET_KEY 未设置（请检查 backend/.env）}"
export FLASK_APP DATABASE_URL SECRET_KEY JWT_SECRET_KEY

# 幂等：先停掉旧 gunicorn（如果存在）
if pgrep -af "venv/bin/gunicorn .* app:create_app" >/dev/null 2>&1; then
    pkill -f "venv/bin/gunicorn .* app:create_app" || true
    sleep 1
fi

nohup gunicorn -w 4 -b 127.0.0.1:5000 --threads 2 --timeout 120 \
    --chdir "$PROJECT_DIR/backend" \
    --access-logfile "$PROJECT_DIR/logs/gunicorn-access.log" \
    --error-logfile  "$PROJECT_DIR/logs/gunicorn-error.log" \
    "app:create_app()" \
    >> "$PROJECT_DIR/logs/gunicorn-stdout.log" 2>&1 &
disown
sleep 2
echo "    gunicorn pid: $!"

echo ""
echo "=== 部署完成 ==="
echo "  前端访问：http://<本机IP>/"
echo "  API 入口：http://<本机IP>/api"
echo "  后端直连：http://127.0.0.1:5000（仅本机）"
echo "  日志路径：$PROJECT_DIR/logs/{gunicorn-access,gunicorn-error,gunicorn-stdout}.log"

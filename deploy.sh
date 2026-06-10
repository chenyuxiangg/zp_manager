#!/bin/bash
set -e

PROJECT_DIR="/var/www/zpersion"
cd "$PROJECT_DIR"

echo "=== 部署 Zpersion 学习管理系统 ==="

echo "[1/5] 安装后端依赖..."
cd backend
pip install -r requirements.txt

echo "[2/5] 构建前端..."
cd ../frontend
npm install
npm run build

echo "[3/5] 配置Nginx..."
sudo cp nginx/zpersion.conf /etc/nginx/sites-available/zpersion
sudo ln -sf /etc/nginx/sites-available/zpersion /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "[4/5] 启动后端服务..."
cd ../backend
export FLASK_APP=app.py
nohup gunicorn -w 4 -b 127.0.0.1:5000 --threads 2 --timeout 120 app:app > ../logs/backend.log 2>&1 &

echo "[5/5] 部署完成!"
echo "请访问 http://your-domain.com"
# Zpersion 开发指南

> 5 分钟跑起来 + 日常开发命令速查

---

## 一、环境要求

| 工具 | 版本 | 用途 |
|------|------|------|
| Python | 3.10+ | 后端运行时 |
| Node.js | 18+ | 前端构建 |
| MySQL | 8.0+ | 生产数据库（开发可用 SQLite） |
| Git | 2.30+ | 版本管理（可选，本项目无 git 仓库） |

---

## 二、5 分钟快速启动

### 2.1 克隆 / 解压发布包

```bash
# 如果是 tgz 包
tar -xzf zpersion-v1.0.0-20260606.tgz
cd zpersion-v1.0.0-20260606
```

### 2.2 后端

```bash
cd backend

# 1) 创建并激活 Python 虚拟环境（强烈建议，避免污染系统 Python）
python3 -m venv venv
source venv/bin/activate            # Linux/macOS
# venv\Scripts\activate             # Windows PowerShell

# 2) 安装依赖
pip install --upgrade pip
pip install -r requirements.txt

# 3) 创建 .env 文件（项目不提供 .env.example，请按以下模板填写）
cat > .env <<'EOF'
FLASK_APP=app.py

# === 数据库（MySQL）===
DATABASE_URL=mysql+pymysql://zpersion:YOUR_PASSWORD@127.0.0.1:3306/zlearn_db?charset=utf8mb4

# === 安全密钥（必须修改为随机长字符串）===
SECRET_KEY=please-change-me-to-a-random-string-min-32-chars
JWT_SECRET_KEY=please-change-me-to-another-random-string-min-32-chars

# === 邮件（可选，缺失时密码重置降级为日志输出）===
MAIL_SERVER=smtp.qq.com
MAIL_PORT=587
MAIL_USE_TLS=true
MAIL_USERNAME=your-email@qq.com
MAIL_PASSWORD=your-smtp-auth-code
MAIL_DEFAULT_SENDER=noreply@zpersion.com

# === 前端回调地址（密码重置链接拼接用）===
FRONTEND_URL=http://localhost:5173
EOF

# 4) 初始化数据库
#    开发期：flask run 启动时会自动 create_all
#    生产库：先跑以下 migration
mysql -u root -p zlearn_db < migrations/add_comment_updated_at.sql
mysql -u root -p zlearn_db < migrations/upgrade_datetime_to_microsecond.sql

# 5) 启动（开发模式）
./start.sh
# 监听 http://localhost:5000
# 日志输出到 ../logs/backend.log
```

> ⚠️ **必填项**：DATABASE_URL / SECRET_KEY / JWT_SECRET_KEY 缺失时 `start.sh` 会 fail-fast，不会静默回退到硬编码值。
>
> ⚠️ **数据库命名说明**：本项目产品名是 **Zpersion**，但数据库名沿用历史命名 `zlearn_db`（见 `scripts/init_db.sql`）。修改产品名/库名需同步更新 start.sh、migrations、所有文档引用。

### 2.3 前端

```bash
cd ../frontend

# 1) 安装依赖
npm install

# 2) 创建 .env.development（项目不提供 .env.example，请按需填写）
cat > .env.development <<'EOF'
# false → 联调真实后端（推荐）
# true  → 仅前端开发（不依赖后端，走 src/mocks/）
VITE_USE_MOCK=false
EOF

# 3) 启动（开发模式）
npm run dev
# 监听 http://localhost:5173
# /api/* 通过 Vite proxy 转发到 5000
```

### 2.4 验证

打开 `http://localhost:5173`，注册一个新账号 → 登录 → 创建计划 → 完成第一个任务。

> ⚠️ **管理员账号说明**：当前系统**不提供在 Web 界面或 API 中创建 admin 账号**的入口。`/api/admin/*` 接口仅 `is_admin=true` 的用户可访问。如需管理后台（用户列表/级联删除），请联系现有管理员手动设置，或参考 FAQ Q8。

---

## 三、日常开发命令

### 3.1 后端

| 命令 | 作用 |
|------|------|
| `./start.sh` | 启动开发服务器（5000 端口） |
| `pkill -f "flask run"` | 停止 |
| `pytest tests/ -v` | 跑全部后端测试（96 用例） |
| `pytest tests/test_xss_fix.py -v` | 跑单个文件 |
| `pytest tests/ --cov=. --cov-report=html` | 覆盖率报告 |

### 3.2 前端

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动 dev server（5173 端口，带 HMR） |
| `npm run build` | 生产构建到 `dist/` |
| `npm run preview` | 预览生产构建 |
| `npm test` | 跑全部前端测试（150 用例） |
| `npm run test:coverage` | 覆盖率报告 |
| `npm run test:watch` | watch 模式 |

### 3.3 一键重启

```bash
# 后端
pkill -f "flask run" && cd backend && ./start.sh &

# 前端
pkill -f "vite" && cd frontend && nohup npm run dev > ../logs/frontend.log 2>&1 &
```

---

## 四、项目结构与代码规范

### 4.1 后端约定

- **蓝图按域拆分**：`auth.py / plans.py / stages.py / tasks.py / reports.py / users.py / admin.py / plan_templates.py`
- **统一响应格式**：`utils.create_response(success=True, data=..., message=..., error=...)`
- **统一错误码**：`UNAUTHORIZED / NOT_FOUND / FORBIDDEN / VALIDATION_ERROR / INVALID_CREDENTIALS / AUTH_ERROR`
- **资源权限**：`utils.check_resource_permission(obj, current_user, resource_name='Task')` — 不存在返 404，跨用户返 403
- **行锁**：`utils.locked_query(query)` — 跨 dialect 兼容（MySQL/PostgreSQL/SQLite）
- **富文本 sanitize**：`utils.sanitize.sanitize_html(content)` 白名单 + `strip_tags(content)` 纯文本
- **测试**：每个新功能必带 pytest，命名 `test_<feature>.py`

### 4.2 前端约定

- **状态管理**：Pinia stores（`stores/auth.js / plans.js / tasks.js`），复杂页面才用 store，简单页面用 local state
- **API 调用**：统一用 `@/api` 的 axios 实例，需要抑制全局错误 toast 时传 `{ skipErrorToast: true }`
- **Mock 模式**：`VITE_USE_MOCK=true` 时 axios 拦截器短路走 `@/mocks/index.js`，无需后端
- **路由**：`@/router/index.js`，需登录的路由用 `meta.requiresAuth: true`
- **复用逻辑**：`@/composables/`（useToast / useDraft / useApiResponse / useFormValidation / useBackNavigation）
- **测试**：vitest + happy-dom，组件/Store/Composable 都需覆盖
- **样式**：CSS 变量在 `@/styles/variables.css`，组件 scoped style 优先，全局样式仅限 reset

### 4.3 Git 提交规范（建议）

```
feat(scope): 新功能
fix(scope): 修 bug
docs(scope): 文档
test(scope): 测试
refactor(scope): 重构
chore(scope): 杂项
```

示例：`feat(tasks): 新增 PATCH /api/tasks/:id/toggle 接口`

---

## 五、测试

### 5.1 后端测试

```bash
cd backend
pytest tests/ -v                    # 全部
pytest tests/test_xss_fix.py -v     # 单独文件
pytest tests/ -k "toggle" -v        # 关键词过滤
pytest tests/ --cov=. --cov-report=term-missing
```

测试文件清单（96 用例）：
- `test_auth.py` (8) — 登录错误码、注册、token 验证
- `test_sanitize.py` (17) — bleach 工具
- `test_xss_fix.py` (10) — title strip_tags
- `test_task_detail.py` (10) — GET /api/tasks/:id
- `test_toggle_task.py` (15) — toggle + 积分回滚
- `test_toggle_lock.py` (5) — 行锁
- `test_comment_fields.py` (10) — 评论字段
- `test_cross_user_403.py` (14) — 跨用户 403
- `test_datetime_precision.py` (4) — DATETIME(6)
- `test_infrastructure.py` (3) — SQLite fixture

### 5.2 前端测试

```bash
cd frontend
npm test                                  # 全部
npm run test:watch                        # watch
npm run test:coverage                     # 覆盖率
npx vitest run src/test/composables/      # 单目录
```

测试文件清单（150 用例，14 文件）：
- `composables/` (9) — useToast / useDraft / useApiResponse / useFormValidation / useBackNavigation
- `mocks/` (13) — mock 路由分发
- `views/` (17) — Login (5) / TaskDetail (9) / Tasks (8，部分)
- `stores/` (32) — auth (8) / tasks (24)
- `api/` (12) — axios 拦截器
- `router/` (5) — 路由配置
- `sanity.spec.js` (5)

---

## 六、Mock 模式 vs 真实后端

| 场景 | VITE_USE_MOCK | 后端状态 |
|------|--------------|---------|
| 纯前端开发（无后端） | `true` | 可关闭 |
| 前后端联调 | `false` | 必须启动 |
| 生产部署 | `false` | 必须启动 |

**注意**：Vite 不会热更新 `.env` 文件，修改后必须重启 `npm run dev`。

---

## 七、发布

### 7.1 打包源码

```bash
cd <project_root>     # 项目根目录（含 release/ 子目录）
./release/release.sh 1.0.0
# 或：VERSION=1.0.0 ./release/release.sh
# 输出：release/zpersion-v1.0.0-YYYYMMDD.tgz
```

### 7.2 排除清单

`release.sh` 打包时**自动排除**：

| 类别 | 项 | 原因 |
|------|----|------|
| 敏感信息 | 真实 `.env`（含密码/token/密钥） | 安全 |
| 编译产物 | `__pycache__/`、`*.pyc`、`node_modules/`、`dist/`、`coverage/` | 体积 |
| 日志缓存 | `logs/`、`*.log`、`.pytest_cache/` | 体积 |
| 个人/开发目录 | `.claude/`、`LNMP/`、`Process/`、`Test/`、`scripts/`、`requires/` | 个人 |
| 自身产物 | `release/` | 避免递归 |

**保留**：`.env.example`（如有）、`SE/PM/`（7 类汇总，对外 PM 视图）、`docs/`（项目对外文档）

> 注：`SE/` 下的原方案文档 / 临时草稿不进 release（仅团队内部归档用）

### 7.3 包结构

```
zpersion-v1.0.0-YYYYMMDD.tgz
├── backend/                # 含 requirements.txt + migrations/
├── frontend/               # 不含 dist/（接收方自行 npm run build）
├── docs/                   # 项目对外文档
├── release/                # 发布脚本
├── nginx/                  # Nginx 配置样例
├── deploy.sh               # 部署脚本
├── pytest.ini
└── CLAUDE.md
```

> 注：项目根目录当前**无 VERSION 文件**，版本号在打包时由 `./release.sh <version>` 参数或 `VERSION` 环境变量指定。

---

## 八、生产部署

> 适用场景：把项目部署到 Linux 服务器，对外提供 https://your-domain.com 服务。

### 8.1 前端构建

```bash
cd frontend
npm install
npm run build
# 产物输出到 frontend/dist/
```

部署时**只需** `dist/` 目录，Nginx 指向该目录即可（见 8.3）。

### 8.2 后端 Gunicorn 启动

**不要用 `flask run` 上生产**（性能差、稳定性差）。

```bash
cd backend
source venv/bin/activate
pip install gunicorn

# 4 worker + 2 threads（与方案.md §15.5 一致）
gunicorn -w 4 --threads 2 -b 127.0.0.1:5000 --timeout 120 app:app
# 后台运行（nohup 或 supervisor / systemd）
nohup gunicorn -w 4 --threads 2 -b 127.0.0.1:5000 app:app > ../logs/backend.log 2>&1 &
```

> 必备环境变量（从 `.env` 加载或 systemd unit 注入）：`DATABASE_URL` / `SECRET_KEY` / `JWT_SECRET_KEY`

### 8.3 Nginx 反向代理

**配置样例**：[nginx/zpersion.conf](../nginx/zpersion.conf) （已纳入 release 包）

⚠️ **部署前必须修改**：
- `server_name`：从通配符 `_` 改为实际域名（如 `zpersion.example.com`）
- `root`：确认 `frontend/dist/` 路径与部署方一致
- 如启用 HTTPS，需加 `listen 443 ssl` 段 + 证书路径（参考 8.4）

完整配置参考（与包内 `nginx/zpersion.conf` 等价）：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/zpersion/frontend/dist;   # ← 指向构建产物
    index index.html;

    # 前端 SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反代到 Gunicorn
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# 启用配置
sudo cp nginx/zpersion.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/zpersion.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 8.4 HTTPS

项目未自带证书，部署方自行准备。可选方案：
- Let's Encrypt（免费，`certbot --nginx -d your-domain.com`）
- 阿里云/腾讯云免费证书
- 自签证书（仅测试）

### 8.5 数据备份与恢复

```bash
# ===== 备份 =====
# 每日凌晨 crontab 备份（推荐保留 7 天）
0 2 * * * /usr/bin/mysqldump -u zpersion -pYOUR_PASS zlearn_db | gzip > /backup/zpersion-$(date +\%Y\%m\%d).sql.gz

# ===== 恢复 =====
gunzip < /backup/zpersion-20260606.sql.gz | mysql -u zpersion -pYOUR_PASS zlearn_db
```

### 8.6 Docker 部署

> 当前项目**不提供 Dockerfile / docker-compose.yml**。如需容器化部署，需自行封装：
> - backend 镜像：基于 `python:3.10-slim`，安装 requirements，复制代码，启动 `gunicorn app:app`
> - frontend 镜像：多阶段构建（node:18 build → nginx:alpine serve dist/）
> - 数据库镜像：使用 `mysql:8.0`，挂载 volume 持久化
>
> 部署方案设计参考：原 `SE/方案.md §9.4`（内部文档，发布版本不包含）。

---

## 九、常见问题

### Q1: 启动后端报 `ModuleNotFoundError`
→ `pip install -r requirements.txt` 漏装；或虚拟环境未激活。

### Q2: 启动前端报 `EADDRINUSE :::5173`
→ `pkill -f vite` 杀掉旧进程；或改 `vite.config.js` 的 `server.port`。

### Q3: 前端调 API 报 404
→ 检查 Vite proxy（`vite.config.js` 已有 `/api → 5000` 转发）；检查后端是否启动。

### Q4: 登录后跳回登录页
→ Token 失效（黑名单 / 过期）；`localStorage.removeItem('token')` 后重新登录。

### Q5: 修改 .env 不生效
→ Vite 不会热更新 .env；`pkill -f vite && cd frontend && npm run dev`。

### Q6: MySQL 中文乱码
→ 确认 `DATABASE_URL` 含 `?charset=utf8mb4`；表/列也需 utf8mb4。

### Q7: 跑测试报 `fixture not found`
→ `tests/conftest.py` 缺失；检查是否在 `backend/` 目录下运行 pytest。

### Q8: 如何创建 admin 账号？
→ 当前系统**不提供** Web/API 创建入口。需要直接修改数据库：

```sql
-- MySQL 手动提升某个用户为 admin
UPDATE users SET is_admin = 1 WHERE email = 'your-admin@example.com';
```

修改后该用户**重新登录**即可获得 admin 权限（Token 中包含 `is_admin` 字段）。生产环境操作前请备份数据库。

---

## 十、推荐阅读

- [README.md](README.md) — 项目介绍
- [API.md](API.md) — 接口手册

---

> 最后更新：2026-06-06

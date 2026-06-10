# Zpersion 学习管理系统

> 一款面向自驱型学习者的目标管理 + 进度追踪 Web 应用

---

## 一、产品定位

Zpersion 是为「自驱型学习者」设计的目标管理与进度追踪系统。用户可以：

- 创建学习计划（如「高考数学冲刺 90 天」），拆分为多个阶段，每个阶段分配具体任务
- 完成任务赚取积分，激励持续学习
- 在任务上添加评论（富文本），用于自我复盘与学习笔记
- 通过报表（周/月/年）复盘完成率、积分趋势、逾期情况
- 把常用计划导出为模板，个人账号下复用或基于系统预置模板快速创建

**核心价值**：把「模糊的长期目标」拆解成「可量化、可追踪、可激励」的日常任务。

---

## 二、核心功能

| 模块 | 路径 | 说明 |
|------|------|------|
| 认证 | `/api/auth/*` | 注册 / 登录 / 登出 / 忘记密码 / 重置密码 / 获取当前用户；JWT + 黑名单 |
| 学习计划 | `/api/plans/*` | 计划的 CRUD + 阶段 CRUD + 模板导入导出 |
| 任务 | `/api/tasks/*` | 今日/超期/全部任务、任务详情、toggle 完成（含积分回滚）、评论 CRUD |
| 报表 | `/api/reports/*` | 周报 / 月报 / 年报生成 + 历史列表 |
| 用户 | `/api/users/*` | 个人信息、提醒配置、积分历史 |
| 管理 | `/api/admin/*` | 用户列表 + 级联删除（需 admin） |
| 模板 | `/api/plan-templates/*` | 系统预置模板（user_id=0）+ 个人模板 + 从模板创建计划 |

---

## 三、技术栈

### 后端
- **Python 3.10** + **Flask 3.0** + **Flask-SQLAlchemy 3.1**
- **MySQL 8.0+** （生产）/ SQLite（测试）
- **PyJWT** + 黑名单机制实现 token 撤销
- **bleach** 实现富文本 XSS 防护
- **Flask-Mail** 实现密码重置邮件
- 关系模型：User → Plan → Stage → Task → Comment（外键级联删除）
- 集成：PyMySQL、cryptography、python-dotenv、python-dateutil

### 前端
- **Vue 3.4** + **Composition API** + **Pinia 2.1**（状态管理）
- **Vue Router 4.2** + **Axios 1.6**（带 mock 拦截器）
- **Vite 5.0** 构建；**Vitest 2.1** 测试
- **@vueup/vue-quill** 富文本编辑器
- **dayjs** 相对时间展示
- **canvas-confetti** 计划完成庆祝
- **driver.js** 新用户引导

### 基础设施
- **Gunicorn** 生产 WSGI（4 worker + 2 threads）
- **Nginx** 反向代理 + 静态资源
- **MySQL 8.0** 持久化

---

## 四、项目结构

```
zpersion/
├── backend/                  # Flask 后端
│   ├── app.py                # 应用工厂
│   ├── config.py             # 配置（DB / JWT / 邮件）
│   ├── start.sh              # 开发期启动脚本（flask run，自动读 .env）
│   ├── requirements.txt
│   ├── .env                  # ⚠️ 真实环境变量（含密钥，不入库；按 DEVELOPING.md §二 模板手建）
│   ├── models/               # SQLAlchemy 模型
│   │   └── __init__.py
│   ├── routes/               # 蓝图（按域拆分）
│   │   ├── auth.py plans.py stages.py tasks.py
│   │   ├── reports.py users.py admin.py
│   │   └── plan_templates.py
│   ├── services/             # 业务服务（积分/邮件/报表）
│   ├── utils/                # 工具（JWT/sanitize/locked_query/check_resource_permission）
│   ├── migrations/           # SQL 迁移脚本
│   └── tests/                # pytest 测试（96 用例）
│
├── frontend/                 # Vue 3 前端
│   ├── package.json / package-lock.json
│   ├── vite.config.js        # 含 /api → 5000 端口代理
│   ├── vitest.config.js
│   ├── index.html
│   ├── .env.development      # VITE_USE_MOCK 开关（按 DEVELOPING.md §二.3 模板手建）
│   └── src/
│       ├── api/              # axios + 拦截器（skipErrorToast / mock 路由）
│       ├── components/       # 通用组件
│       ├── composables/      # 业务复用逻辑（useDraft/useApiResponse/useToast）
│       ├── mocks/            # mock 模式数据（VITE_USE_MOCK=true 时启用）
│       ├── plugins/          # Vue 插件
│       ├── router/           # Vue Router
│       ├── stores/           # Pinia stores（auth/plans/tasks）
│       ├── styles/           # CSS 变量与全局样式
│       ├── utils/            # 前端工具
│       ├── views/            # 页面（Login/Dashboard/Plans/Tasks/Reports/Settings/Admin）
│       └── test/             # vitest 测试（150 用例）
│
├── docs/                     # 发布包文档（仅此目录对外发布）
│   ├── README.md             # ← 本文件
│   ├── DEVELOPING.md         # 开发指南
│   └── API.md                # API 手册
│
├── release/
│   └── release.sh            # 发布脚本
│
├── pytest.ini                # pytest 配置
├── CLAUDE.md                 # Claude Code 项目约定
└── nginx/                    # Nginx 配置样例（zpersion.conf）
```

---

## 五、关键决策摘要

| 决策 | 内容 | 理由 |
|------|------|------|
| D1 | 撤销任务完成时**扣回已奖励积分** | 防止刷分；保留 PointLog 审计 |
| D2 | 撤销后 `status` 回到 `pending` | 状态机简单清晰 |
| D3 | 删除任务保留 PointLog 悬空引用 | 审计可追溯 |
| D4 | 所有富文本（task/plan/stage/comment）全量 sanitize | XSS 防护，title 额外 `strip_tags` |
| D5 | 错误码 `INVALID_CREDENTIALS` + 中文 | 与旧 `AUTH_ERROR` 区分，便于前端精确判断 |
| D6 | `GET /api/tasks/:id` 一次返回 stage/plan | 避免前端 N+1 |
| D7 | 跨用户操作返 403，资源不存在返 404 | 兼顾安全与 UX |

---

## 六、当前版本

- **版本号**：v1.0.1（2026-06-06 集成测试完成；打包时由 `release/release.sh <version>` 指定）
- **集成测试**：36/36 用例通过；后端 pytest 96/96 + 前端 vitest 150/150 全绿

---

## 七、文档导航

- 🚀 **新开发者**：先看 [DEVELOPING.md](DEVELOPING.md) 5 分钟跑起来
- 📡 **API 集成**：[API.md](API.md) 接口完整列表
- 📦 **发布**：[../release/release.sh](../release/release.sh) 一键打包

---

> 项目主页：暂未公开
> 维护团队：Zyzs + Claude Code（集成）
> 最后更新：2026-06-06

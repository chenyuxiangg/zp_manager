# Zpersion API 手册

> 完整接口列表 + 请求/响应示例
> 在线 Base URL（开发）：`http://localhost:5000/api`
> 在线 Base URL（生产）：`https://<your-domain>/api`

---

## 通用约定

### 请求
- Content-Type：`application/json`（除非特别说明）
- 认证：`Authorization: Bearer <token>`（除注册/登录/忘记密码/重置密码）
- 时间格式：`YYYY-MM-DD`（日期） / ISO 8601（时间戳，含时区）

### 响应结构
```json
{
  "success": true,
  "data": { ... },
  "message": "可选，成功消息",
  "error": null
}
```

错误响应：
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "人类可读消息"
  }
}
```

### 错误码

| code | HTTP | 含义 | 触发场景 |
|------|------|------|----------|
| `UNAUTHORIZED` | 401 | 认证失败（中间件拦截） | 受保护接口缺失/失效/过期 Token |
| `INVALID_CREDENTIALS` | 401 | 用户名/密码错误 | 仅 `POST /api/auth/login` 密码错误 |
| `AUTH_ERROR` | 401 | 认证失败（业务层返） | `POST /api/auth/forgot-password` / `reset-password` 失败 |
| `FORBIDDEN` | 403 | 无权限 | 跨用户操作（资源存在但属于他人）、admin 越权 |
| `NOT_FOUND` | 404 | 资源不存在 | 任务/计划/评论等不存在 |
| `VALIDATION_ERROR` | 422 | 入参校验失败 | 字段缺失/格式错误 |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 | 未捕获异常 |

### 分页约定

分页查询统一使用 query string：

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `page` | int | 1 | 页码（从 1 开始） |
| `limit` | int | 20 | 每页条数（后端未做强限制） |

响应结构：
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

涉及接口：`GET /api/admin/users`、`GET /api/reports`、`GET /api/users/points-history` 等。

### 频率限制

| 接口 | 限制 | 触发后果 |
|------|------|----------|
| `POST /api/auth/forgot-password` | 同一邮箱 5 分钟内只能请求 1 次 | 静默成功（不报错，但不发邮件） |
| `POST /api/auth/register` | 无显式限制 | — |
| `POST /api/auth/login` | 无显式限制 | — |
| 其他业务接口 | 无显式限制 | 需自行做 client 端防抖 |

### 业务规则

#### 积分规则（`/api/tasks/:id/toggle`、`/api/tasks/:id/complete`）

| 行为 | 积分变动 | 触发条件 |
|------|----------|----------|
| 按时完成任务 | **+10** | `completed_at` 当日 ≤ `scheduled_date` |
| 超期完成 | **+5**（即 `points // 2`） | `completed_at` > `scheduled_date` |
| 超期未完成（每日扣分） | **-5** | 每日凌晨检查（防重复扣分：看 `last_penalized_at`） |
| 单任务扣分上限 | **-50** | 累计扣分到此上限后不再扣 |
| 用户积分下限 | **0** | `max(0, points + delta)` 保护，不会变负 |
| 撤销完成 | **扣回已奖励积分** | 即 `points_delta = -原值`（D1 决策，保留 PointLog 审计） |

#### 评论规则

- 同一任务的评论按 `id` 升序展示
- 评论 `content` 走 `sanitize_html()`（白名单标签 + 属性 + 协议，详见 README §五 D4）
- 编辑评论后 `updated_at` 自动更新（与 `created_at` 可区分）

#### 数据隔离

- 所有受保护接口的查询**强制**带 `WHERE user_id = current_user`（JWT 解析）
- 跨用户访问资源：D7 决策 → 返 `403 FORBIDDEN`（资源存在但属于他人）/ `404 NOT_FOUND`（资源不存在）

### notify_config 字段结构（`/api/users/notify-config`）

```json
{
  "email": "user@example.com",
  "learn_reminder": {
    "enabled": true,
    "timing": "1 day",
    "channels": ["email"]
  },
  "verify_reminder": {
    "enabled": true,
    "timing": "on due",
    "channels": ["email"]
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `email` | string | 是 | 接收提醒的邮箱地址 |
| `learn_reminder.enabled` | bool | 是 | 是否启用学习提醒 |
| `learn_reminder.timing` | enum | 是 | 提前量：`"1 day"` / `"2 days"` / `"1 hour"` / `"2 hours"` |
| `learn_reminder.channels` | array | 是 | 渠道列表（当前仅 `"email"` 实际生效） |
| `verify_reminder.enabled` | bool | 是 | 是否启用验收提醒 |
| `verify_reminder.timing` | enum | 是 | `"on due"`（到期当天 9:00） |
| `verify_reminder.channels` | array | 是 | 渠道列表 |

> **邮件发送条件**：`MAIL_SERVER` / `MAIL_USERNAME` / `MAIL_PASSWORD` 等邮件配置必须就绪（见 DEVELOPING.md §二）。缺失时密码重置功能会**降级为日志输出**，不报错但用户收不到邮件。

---

## 1. 认证 `/api/auth`

### 1.1 注册
```
POST /api/auth/register
Body: { "username": "alice", "email": "alice@example.com", "password": "password123" }
Response 201: { "success": true, "data": { "token": "...", "user": { ... } } }
```

### 1.2 登录
```
POST /api/auth/login
Body: { "email": "alice@example.com", "password": "password123" }
Response 200: { "success": true, "data": { "token": "...", "user": { ... } } }
Response 401: { "success": false, "error": { "code": "INVALID_CREDENTIALS", "message": "用户名或密码不正确" } }
```

### 1.3 登出（将 token 加入黑名单）
```
POST /api/auth/logout
Headers: Authorization: Bearer <token>
Response 200: { "success": true, "message": "Logged out successfully" }
```

### 1.4 获取当前用户
```
GET /api/auth/me
Headers: Authorization: Bearer <token>
Response 200: { "success": true, "data": { "user": { "id", "username", "email", "points", "is_admin", "notify_config" } } }
```

### 1.5 忘记密码
```
POST /api/auth/forgot-password
Body: { "email": "alice@example.com" }
Response 200: { "success": true, "message": "If the email exists, a reset link has been sent" }
```

### 1.6 重置密码
```
POST /api/auth/reset-password
Body: { "token": "<reset_token>", "new_password": "newPassword123" }
Response 200: { "success": true, "message": "Password reset successfully", "data": { "token": "..." } }
```

---

## 2. 学习计划 `/api/plans`

### 2.1 获取计划列表
```
GET /api/plans?status=active
Headers: Authorization: Bearer <token>
Response 200: { "success": true, "data": { "plans": [ { "id", "title", "description", "start_date", "end_date", "status", "created_at" } ] } }
```

### 2.2 获取计划详情
```
GET /api/plans/:id
Headers: Authorization: Bearer <token>
Response 200: { "success": true, "data": { "plan": { "id", "title", "description", "stages": [ ... ] } } }
Response 403: 跨用户 / Response 404: 不存在
```

### 2.3 创建计划
```
POST /api/plans
Body: {
  "title": "高考数学冲刺 90 天",
  "description": "<p>富文本，sanitize 后存储</p>",
  "start_date": "2026-06-01",
  "end_date": "2026-08-30"
}
Response 201: { "success": true, "data": { "plan": { ... } } }
```

### 2.4 更新计划
```
PUT /api/plans/:id
Body: { "title": "...", "description": "..." }
Response 200: { "success": true, "data": { "plan": { ... } } }
```

### 2.5 删除计划
```
DELETE /api/plans/:id
Response 200: { "success": true, "message": "Plan deleted successfully" }
```

### 2.6 创建阶段
```
POST /api/plans/:plan_id/stages
Body: { "title": "阶段1：基础", "description": "...", "order_num": 0, "start_date": "...", "end_date": "..." }
```

### 2.7 更新阶段
```
PUT /api/stages/:id
Body: { "title", "description", "order_num" }
```

### 2.8 删除阶段
```
DELETE /api/stages/:id
Response 200: { "success": true, "message": "Stage deleted" }
```

---

## 3. 任务 `/api/tasks`

### 3.1 按日期查询
```
GET /api/tasks?date=2026-06-06
Response 200: { "success": true, "data": { "tasks": [ { "id", "title", "description", "scheduled_date", "points", "status" } ] } }
```

### 3.2 今日任务
```
GET /api/tasks/today
Response 200: { "success": true, "data": { "tasks": [ ... ] } }
```

### 3.3 超期任务
```
GET /api/tasks/overdue
Response 200: { "success": true, "data": { "tasks": [ ... ] } }
```

### 3.4 任务详情（含 stage/plan 一次 join）
```
GET /api/tasks/:id
Response 200: {
  "success": true,
  "data": {
    "task": {
      "id": 123,
      "stage_id": 5,
      "title": "完成练习册第三章",
      "description": "...",
      "scheduled_date": "2026-06-05",
      "completed_at": null,
      "points": 10,
      "status": "pending",
      "stage": { "id": 5, "title": "...", "plan_id": 3 },
      "plan":  { "id": 3, "title": "..." }
    }
  }
}
```

### 3.5 完成任务（旧接口，幂等）
```
PUT /api/tasks/:id/complete
Response 200: { "success": true, "data": { "task": { ... }, "points_delta": 10 } }
```

### 3.6 切换完成状态（新接口，含积分回滚）
```
PATCH /api/tasks/:id/toggle
Response 200: {
  "success": true,
  "data": {
    "task": { "id", "status": "completed|pending", "completed_at", ... },
    "points_delta": 10  // 标记完成 +10，撤销完成 -10
  }
}
```

### 3.7 更新任务
```
PUT /api/tasks/:id
Body: { "title": "...", "description": "..." }
Response 200: { "success": true, "data": { "task": { ... } } }
```

### 3.8 删除任务
```
DELETE /api/tasks/:id
Response 200: { "success": true, "message": "Task deleted successfully" }
```

---

## 4. 评论 `/api/tasks/:task_id/comments`

### 4.1 获取评论列表（带 username + updated_at）
```
GET /api/tasks/:task_id/comments
Response 200: {
  "success": true,
  "data": {
    "comments": [
      {
        "id": 1,
        "user_id": 5,
        "username": "alice",
        "content": "<p>完成得很棒！</p>",
        "created_at": "2026-06-05T10:00:00.000000",
        "updated_at": null
      }
    ]
  }
}
```

### 4.2 添加评论
```
POST /api/tasks/:task_id/comments
Body: { "content": "<p>富文本，sanitize</p>" }
Response 201: { "success": true, "data": { "comment": { ... } }, "message": "Comment added" }
```

### 4.3 更新评论
```
PUT /api/tasks/:task_id/comments/:comment_id
Body: { "content": "<p>编辑后内容</p>" }
Response 200: { "success": true, "data": { "comment": { ..., "updated_at": "新时间" } }, "message": "Comment updated" }
```

### 4.4 删除评论
```
DELETE /api/tasks/:task_id/comments/:comment_id
Response 200: { "success": true, "message": "Comment deleted" }
```

---

## 5. 报表 `/api/reports`

### 5.1 生成周报
```
GET /api/reports/weekly?date=2026-06-06
Response 200: {
  "success": true,
  "data": {
    "report": {
      "period": "2026-W23",
      "period_start": "2026-06-01",
      "period_end": "2026-06-07",
      "summary": { "total_tasks", "completed_tasks", "completion_rate", "points_earned", "points_spent" },
      "overdue_tasks": [ ... ],
      "upcoming_tasks": [ ... ],
      "comment_count": 2
    }
  }
}
```

### 5.2 生成月报
```
GET /api/reports/monthly?date=2026-06-01
```

### 5.3 生成年报
```
GET /api/reports/yearly?date=2026-01-01
```

### 5.4 报表历史列表
```
GET /api/reports?type=weekly&page=1&limit=20
Response 200: { "success": true, "data": { "reports": [ ... ], "total": 100 } }
```

---

## 6. 用户 `/api/users`

### 6.1 获取个人信息
```
GET /api/users/profile
Response 200: { "success": true, "data": { "user": { "id", "username", "email", "points", "notify_config" } } }
```

### 6.2 更新提醒配置
```
PUT /api/users/notify-config
Body: {
  "learn_reminder": { "enabled": true, "timing": "1 day", "channels": ["email"] },
  "verify_reminder": { "enabled": true, "timing": "on due", "channels": ["email"] },
  "email": "alice@example.com"
}
```

### 6.3 积分历史
```
GET /api/users/points-history?page=1&limit=20
Response 200: {
  "success": true,
  "data": {
    "logs": [
      { "id", "task_id", "points_delta", "reason", "created_at" }
    ]
  }
}
```

---

## 7. 管理 `/api/admin`（需 admin）

### 7.1 用户列表
```
GET /api/admin/users?page=1&limit=20
Response 200: { "success": true, "data": { "users": [ ... ], "total": 50 } }
```

### 7.2 删除用户（级联）
```
DELETE /api/admin/users/:user_id
Response 200: { "success": true, "message": "User deleted (cascade)" }
```

---

## 8. 模板 `/api/plan-templates`

> 模板分两类：`user_id=0` 的**系统预置模板**（不可删除），`user_id>0` 的**个人模板**（仅创建者可删除）。列表接口**自动返回**当前用户可访问的全部模板，无需传参。

### 8.1 获取模板列表
```
GET /api/plan-templates
Headers: Authorization: Bearer <token>
Response 200: {
  "success": true,
  "data": {
    "templates": [
      { "id", "title", "description", "user_id", "created_at" }
    ]
  }
}
```
注：返回当前用户可访问的全部模板（个人 + 系统预置）；`user_id=0` 表示系统预置。

### 8.2 获取模板详情（含完整阶段/任务结构）
```
GET /api/plan-templates/:id
Response 200: {
  "success": true,
  "data": {
    "template": {
      "id", "title", "description",
      "stages": [
        {
          "id", "title", "description", "order_num",
          "start_day", "end_day",
          "tasks": [
            { "id", "title", "description", "points", "day_offset" }
          ]
        }
      ]
    }
  }
}
Response 404: 模板不存在或不属于当前用户
```

### 8.3 从计划导出为模板
```
POST /api/plan-templates
Headers: Authorization: Bearer <token>
Content-Type: application/json
Body: { "plan_id": 17 }
Response 201: { "success": true, "data": { "template": { ... } } }
Response 404: 计划不存在
```
行为：将计划 + 阶段 + 任务转换为模板（日期转为相对 `start_day`/`end_day`/`day_offset`）。

### 8.4 从模板创建计划
```
POST /api/plan-templates/from-template
Headers: Authorization: Bearer <token>
Content-Type: application/json
Body: {
  "template_id": 5,
  "start_date": "2026-07-01"
}
Response 201: { "success": true, "data": { "plan": { ... } } }
Response 404: 模板不存在或不可访问
```
行为：以 `start_date` 为基准，阶段日期 = start_date + start_day/end_day，任务日期 = start_date + day_offset，自动生成完整的 Plan + Stage + Task。

### 8.5 删除模板（仅创建者可删）
```
DELETE /api/plan-templates/:id
Response 200: { "success": true, "message": "Template deleted" }
Response 403: { "success": false, "error": { "code": "FORBIDDEN" } }  # 非创建者
Response 404: 模板不存在
```
注：系统预置模板（`user_id=0`）不可删除。

### 8.6 从本地 JSON 文件导入计划
```
POST /api/plan-templates/import
Headers: Authorization: Bearer <token>
Content-Type: multipart/form-data
Form: file=<plan.json>
Response 201: { "success": true, "data": { "plan": { "id", "title" } } }
Response 422: { "success": false, "error": { "code": "VALIDATION_ERROR", "message": "..." } }
```
JSON 格式参考：
```json
{
  "title": "英语学习30天计划",
  "description": "每天学习2小时",
  "stages": [
    {
      "title": "第一周",
      "description": "基础词汇",
      "start_day": 1,
      "end_day": 7,
      "tasks": [
        { "title": "背50个单词", "points": 10, "day_offset": 1 }
      ]
    }
  ]
}
```
行为：解析 JSON 直接创建 Plan + Stage + Task（不经过模板实体），`start_date` 默认为当天，`end_date` 按 `stages` 中最大 `end_day` 计算。

---

## 9. 端到端调用示例

### cURL 完整流程

```bash
# 1) 登录
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

# 2) 创建计划
curl -X POST http://localhost:5000/api/plans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"示例计划","start_date":"2026-06-01","end_date":"2026-08-30"}'

# 3) 切换任务完成状态
curl -X PATCH http://localhost:5000/api/tasks/123/toggle \
  -H "Authorization: Bearer $TOKEN"

# 4) 添加评论
curl -X POST http://localhost:5000/api/tasks/123/comments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content":"<p>完成得很棒！</p>"}'
```

### Axios 前端调用

```js
import api from '@/api'

// 普通调用（错误由全局 toast 处理）
const res = await api.get('/tasks/today')
if (res.success) {
  this.tasks = res.data.tasks
}

// 抑制全局 toast（自己处理错误，例如登录场景）
const res = await api.post(
  '/auth/login',
  { email, password },
  { skipErrorToast: true }
)
```

---

## 10. 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-06-06 | v1.1 | 跨用户操作区分 404/403（D7）；toggle 行锁；title strip_tags；DATETIME(6) 升级 |
| 2026-06-05 | v1.0 | 初版：INVALID_CREDENTIALS、GET /api/tasks/:id、PATCH /toggle、comment 字段、HTML sanitize |

---

> 完整字段定义以本文档为准
> 集成测试结果见 [README.md §六](README.md)

# 错误码字典

> 本文件列出后端所有错误码，前端 `src/constants/errorCodes.js` 由 `scripts/sync_error_codes.py` 同步生成。
> 来源：`backend/utils/error_codes.py`（单一事实来源）
> 引入版本：v1.2.0（RR2 PR0017）

---

## 错误响应体结构

所有 4xx/5xx 响应统一格式：

```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "用户名或密码不正确"
  },
  "retry_after_seconds": 120   // 可选：仅 RATE_LIMITED 等动态字段
}
```

`error.message` 保留 RR1 既有语义（前端 toast 用），`error.code` 是 PR0017 新增，前端用 `code` 精确分支。

---

## 错误码清单

### 401 未认证

| Code | Message | 触发场景 | 前端处理 |
|---|---|---|---|
| `INVALID_CREDENTIALS` | 用户名或密码不正确 | 登录密码错 | toast.error 提示 |
| `TOKEN_EXPIRED` | 登录已过期，请重新登录 | JWT 过期 | 跳登录页 + 软跳 |
| `TOKEN_REVOKED` | 登录凭证已失效 | 用户主动登出后 token 重用 | 跳登录页 |
| `UNAUTHORIZED` | 请先登录 | 请求无 token | 跳登录页 |

### 403 无权限

| Code | Message | 触发场景 | 前端处理 |
|---|---|---|---|
| `PERMISSION_DENIED` | 无权限访问 | 资源非 owner | toast.error + 跳 dashboard |
| `NOT_ADMIN` | 需要管理员权限 | admin_required 失败 | toast.error + 跳 dashboard |
| `NOT_OWNER` | 只能操作自己的资源 | 改/删他人评论等 | toast.error |

### 404 资源不存在

| Code | Message | 触发场景 | 前端处理 |
|---|---|---|---|
| `RESOURCE_NOT_FOUND` | 资源不存在 | task/plan/stage/comment/template 不存在 | toast.error |

### 409 业务规则冲突

| Code | Message | 触发场景 | 前端处理 |
|---|---|---|---|
| `TITLE_DUPLICATED` | 名称已存在 | 创建重名 plan/stage/task | toast.error + 输入框聚焦 |
| `TASK_ALREADY_COMPLETED` | 已完成任务不可删除，请先撤销完成 | 删 completed task | toast.error + 弹"撤销并删除"提示 |
| `POMODORO_ALREADY_RUNNING` | 该任务已有专注进行中 | 任务详情页重复开番茄 | toast.error + 提示"先结束上一个" |
| `PLAN_NOT_ARCHIVABLE` | 存在未完成的阶段，无法归档 | 归档 plan 时有未完成 stage | toast.error |
| `STAGE_NOT_COMPLETABLE` | 存在未完成的任务，无法完成阶段 | 完成 stage 时有未完成 task | toast.error |
| `PLAN_HAS_COMPLETED_TASKS` | 计划下存在已完成的任务，无法删除 | 删 plan 时含 completed task | toast.error + 提示"先撤销" |
| `RATE_LIMITED` | 30 分钟内不可重复操作，请稍后再试 | toggle 30 分钟内重复 | toast.error + 显示 retry_after_seconds |

### 400 输入不合法

| Code | Message | 触发场景 | 前端处理 |
|---|---|---|---|
| `INVALID_INPUT` | 输入不合法 | 缺字段/空标题/XSS 清洗为空 | toast.error + 表单字段高亮 |
| `RESET_TOKEN_INVALID` | 重置链接无效或已过期 | 密码重置 token 失效 | 跳 forgot-password |

### 500 基础设施错误

| Code | Message | 触发场景 | 前端处理 |
|---|---|---|---|
| `INTERNAL_ERROR` | 服务内部错误 | 未捕获异常 | toast.error + "请稍后重试" |
| `DB_ERROR` | 数据存储错误 | DB 写失败 | toast.error + "数据存储失败" |
| `EMAIL_SEND_FAILED` | 邮件发送失败，请稍后重试 | SMTP 失败 | toast.warn（不阻断） |

---

## 同步约束

- 后端修改错误码：先改 `backend/utils/error_codes.py`，再 `python scripts/sync_error_codes.py`
- CI 关卡：`python scripts/sync_error_codes.py --check` 必须返 0
- 路由层禁止字面量：CI grep `'[A-Z_]{4,}' backend/routes/*.py` 应 0 命中（除注释）

---

## 与 RR1 决策 D5 的关系

- D5：旧 AUTH_ERROR 已废弃，INVALID_CREDENTIALS + 中文 message 单一对外文案
- 本 PR 把 D5 推广到所有错误码（不仅是认证类）
- message 字段保留 RR1 既有文案，避免前端 toast 文案突变

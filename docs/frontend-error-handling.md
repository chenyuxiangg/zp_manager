# 前端错误处理约定

> 来源：PR0017 B0143 挂靠项
> 适用版本：v1.2.0+（RR2 PR0017）
> 前端代码：`frontend/src/api/`（axios 拦截器）、`frontend/src/composables/useApiResponse.js`、`frontend/src/composables/useToast.js`

---

## 1. axios 拦截器分支

`api/axios.js` 在 `response.error` 拦截器中按 `err.code` 精确分支：

```js
// 伪代码
if (err.code === 'TOKEN_EXPIRED' || err.code === 'TOKEN_REVOKED' || err.code === 'UNAUTHORIZED') {
  // 401 系列：清本地态 + 跳登录页（PR0013 配套）
  authStore.clearLocalAuth()
  router.push({ name: 'login', query: { reason: 'expired' } })
  return // 静默：避免重复 toast
}
```

| 错误码 | 拦截器行为 |
|---|---|
| `TOKEN_EXPIRED` / `TOKEN_REVOKED` / `UNAUTHORIZED` | 静默跳登录页，不弹 toast |
| `PERMISSION_DENIED` / `NOT_ADMIN` | toast.error，**不**跳转（避免跳太多） |
| `RATE_LIMITED` | toast.error，文案带 `retry_after_seconds` 提示 |
| `TASK_ALREADY_COMPLETED` | toast.error，按钮置灰 + 引导"撤销并删除" |
| `TITLE_DUPLICATED` | toast.error，关联 input 框聚焦 |
| `INVALID_INPUT` | toast.error，关联字段高亮红框 |
| 其他 4xx | toast.error 显示 `err.error.message` |
| 5xx | toast.error 显示通用"服务异常" |

---

## 2. 静默规则

- **全局静默**：401 全部静默（避免"登录已过期"与"页面切回"的 toast 重复）
- **本地静默**：`axios.get('/api/...', { skipErrorToast: true })` 单次免 toast
  - 适用于：轮询/心跳接口、用户主动 dismiss 后的重试

---

## 3. err.code 优先 vs err.message 兜底

**优先 err.code** —— 前端业务逻辑（路由跳转/按钮置灰/字段聚焦）必须基于 code 分支。

**err.message 仅用于 toast 文案展示** —— 不要用 `if (err.message === '用户名或密码不正确')` 做业务判断。

理由：
- message 字段 i18n 时会变（RR4 评估）
- code 是稳定契约（CI 强制 sync，前后端一一对应）

---

## 4. 错误码常量使用

```js
import { ERROR_CODES } from '@/constants/errorCodes'

if (err.code === ERROR_CODES.TASK_ALREADY_COMPLETED) {
  // ...
}
```

**禁止**在代码中写 `err.code === 'TASK_ALREADY_COMPLETED'` 字面量。lint 阶段可加 `@typescript-eslint/no-string-literal` 规则。

---

## 5. 跨 worker 异步错误

某些错误由 worker（PR0001 reminder、PR0006 streak settle）异步触发，**不会**经过 axios 拦截器。前端处理：
- 列表页用 `setInterval` 轮询（30s）刷新数据
- 详情页用 `useAsyncData` composable 自动 refresh
- 不在前端"主动拉错误"——worker 错误在用户下次操作时通过接口反映

---

## 6. 与 PR0013 的关系

PR0013（Token 过期守卫）依赖本约定：401 触发软跳逻辑要按 err.code 走，**不**依赖 err.message。

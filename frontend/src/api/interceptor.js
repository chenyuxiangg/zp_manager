// PR0017 — handleApiError 纯函数，按 err.code 精确分支
// 从 api/index.js 抽出，便于单测；PR0013 401 守卫将扩展此函数
//
// 行为契约（test/api/errorCodes.spec.js 守护）：
//   - RATE_LIMITED → toast.warn
//   - TASK_ALREADY_COMPLETED / POMODORO_ALREADY_RUNNING / TITLE_DUPLICATED → toast.error 友好文案
//   - PERMISSION_DENIED → 静默（由路由守卫处理）
//   - 其他 → fallback 到 err.message

import { ERROR_CODES, ERROR_MESSAGES } from '@/constants/errorCodes'

/**
 * 解析 toast 实例：支持参数注入（测试）/ 模块查找（生产）
 */
function resolveToast(injected) {
  if (injected) return injected
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@/composables/useToast')
    return mod.useToast()
  } catch {
    return null
  }
}

/**
 * 简单占位符替换：{retry_after_seconds} → 友好中文
 */
function formatMessage(template, data) {
  if (!data?.retry_after_seconds) return template
  const minutes = Math.ceil(data.retry_after_seconds / 60)
  return template.replace(/\{retry_after_seconds\}/g, `${minutes} 分钟`)
}

export function handleApiError(err, opts = {}) {
  const config = err?.config || {}
  const skipErrorToast = config.skipErrorToast === true || opts.skipErrorToast === true
  if (skipErrorToast) return

  const status = err?.response?.status
  const data = err?.response?.data || {}
  // B0311：PR0017 后端契约是 `{success:false, error:{code, message}, ...kwargs}` 嵌套结构
  // 兼容旧顶层契约（迁移期可能还有非 error_codes 错误码）
  const errorBody = data.error || data
  const code = errorBody.code
  const toast = resolveToast(opts.toast)
  if (!toast) return

  // ── PR0013: 401 软跳 — 单次触发 + router.push + 清 store
  if (status === 401) {
    const auth = opts.auth
    const router = opts.router
    if (auth && !auth.isRedirecting) {
      auth.setRedirecting(true)
      auth.clearLocalAuth()
      const reason = code === 'TOKEN_EXPIRED' || code === 'TOKEN_REVOKED' ? 'expired' : 'expired'
      const msg = errorBody.message || data.message || '会话已过期，请重新登录'
      toast.error(msg)
      const currentPath = router?.currentRoute?.value?.path
      if (router && currentPath !== '/login') {
        const p = router.push({ path: '/login', query: { reason } })
        if (p && typeof p.finally === 'function') {
          p.finally(() => auth.setRedirecting(false))
        } else {
          auth.setRedirecting(false)
        }
      } else {
        auth.setRedirecting(false)
      }
    }
    return
  }

  // ── 静默码只保留 UNAUTHORIZED（401 已在 index.js 处理），其他 403 码
  // (PERMISSION_DENIED/NOT_ADMIN/NOT_OWNER) 走 ERROR_MESSAGES 友好文案
  // 显示给用户（B0311 设计意图）。路由守卫场景可传 skipErrorToast: true 静默。
  const SILENT_CODES = new Set([
    ERROR_CODES.UNAUTHORIZED,
  ])
  if (code && SILENT_CODES.has(code)) return

  // ── 业务规则 409/400 优先按 code 精确分支
  if (code && ERROR_MESSAGES[code]) {
    const message = formatMessage(ERROR_MESSAGES[code], data)
    if (code === ERROR_CODES.RATE_LIMITED) {
      toast.warn(message)
    } else {
      toast.error(message)
    }
    return
  }

  // ── 403 无 code 兜底（RR1 兼容）：有 code 的走上面 ERROR_MESSAGES 分支
  if (status === 403) {
    toast.error('无权限操作')
    return
  }

  // ── 5xx / 网络错误
  if (status >= 500) {
    toast.error('服务器错误，请稍后重试')
    return
  }
  if (!err.response) {
    toast.error('网络连接失败，请检查网络后重试')
    return
  }

  // ── fallback：errorBody.message / data.message / 通用
  const message = errorBody.message || data.message || '操作失败'
  toast.error(message)
}

export { ERROR_CODES }

// PR0013 + B0305 + B0309 — Token 过期守卫
// 行为契约 (test/composables/useTokenExpiry.spec.js 守护):
//   - B0309: 接 Ref<string|null> token，自动 watch 重置 warned 状态
//   - B0305: token 过期主动 router.push('/login?reason=expired') + toast.error + clearLocalAuth
//   - 5 分钟预告 toast.warning 触发一次（不重复）
//   - 支持 onExpired 自定义回调（可选）
//   - 无效 token 静默 clearLocalAuth
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { jwtDecode } from 'jwt-decode'
import { useAuthStore } from '@/stores/auth'
import { useToast } from './useToast'
import { useRouter } from 'vue-router'

const DEFAULTS = {
  warnBeforeMs: 5 * 60 * 1000,
  checkIntervalMs: 60_000,
}

/**
 * @param {import('vue').Ref<string|null>} tokenRef - 响应式 token
 * @param {object} [opts]
 * @param {(info: {reason:string}) => void} [opts.onExpired] - 自定义过期回调（默认 router.push + toast）
 * @param {number} [opts.warnBeforeMs] - 过期前多少 ms 触发预告
 * @param {number} [opts.checkIntervalMs] - 检查间隔
 */
export function useTokenExpiry(tokenRef, opts = {}) {
  const authStore = useAuthStore()
  const toast = useToast()
  let router = null
  try { router = useRouter() } catch { /* not in setup (test) */ }

  const warnBeforeMs = opts.warnBeforeMs ?? DEFAULTS.warnBeforeMs
  const checkIntervalMs = opts.checkIntervalMs ?? DEFAULTS.checkIntervalMs

  const warned = ref(false)
  let timer = null

  const checkTokenExpiry = () => {
    const token = typeof tokenRef === 'function' ? tokenRef() : tokenRef?.value
    if (!token) {
      warned.value = false
      return
    }

    try {
      const payload = jwtDecode(token)
      const exp = payload.exp * 1000
      const now = Date.now()
      const remaining = exp - now

      if (remaining <= 0) {
        // B0305: 主动跳登录 + toast + 清 local auth
        authStore.clearLocalAuth()
        toast.error('会话已过期，请重新登录')
        if (opts.onExpired) {
          opts.onExpired({ reason: 'expired' })
        } else if (router && router.currentRoute?.value?.path !== '/login') {
          router.push({ path: '/login', query: { reason: 'expired' } })
        }
        warned.value = false  // 重置
      } else if (remaining < warnBeforeMs && !warned.value) {
        toast.warning('登录即将过期，请注意保存工作进度')
        warned.value = true
      }
    } catch (e) {
      // 无效 token — 静默清掉
      try { authStore.clearLocalAuth() } catch { /* ignore */ }
    }
  }

  const start = () => {
    if (timer) clearInterval(timer)
    timer = setInterval(checkTokenExpiry, checkIntervalMs)
    checkTokenExpiry()
  }
  const stop = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  // B0309: watch token 变化时重置 warned（避免 token 换新后旧预告状态泄漏）
  let stopWatch = null
  if (tokenRef && typeof tokenRef === 'object' && 'value' in tokenRef) {
    stopWatch = watch(tokenRef, (newToken, oldToken) => {
      if (newToken !== oldToken) {
        warned.value = false
        // 新 token 后立即检查
        checkTokenExpiry()
      }
    })
  }

  onMounted(() => start())
  onUnmounted(() => {
    stop()
    if (stopWatch) stopWatch()
  })

  return {
    checkTokenExpiry,
    start,
    stop,
  }
}
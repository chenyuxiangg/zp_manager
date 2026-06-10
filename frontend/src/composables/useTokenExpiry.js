import { ref, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from './useToast'

export function useTokenExpiry(options = { warnBeforeMs: 5 * 60 * 1000, checkIntervalMs: 60000 }) {
  const authStore = useAuthStore()
  const toast = useToast()
  const warned = ref(false)
  let timer = null

  const checkTokenExpiry = () => {
    const token = authStore.token
    if (!token) return

    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const exp = payload.exp * 1000
      const now = Date.now()
      const remaining = exp - now

      if (remaining <= 0) {
        // Token 已过期
        authStore.logout()
        window.location.href = '/login'
      } else if (remaining < options.warnBeforeMs && !warned.value) {
        // 提前警告
        toast.warning('登录即将过期，请注意保存工作进度')
        warned.value = true
      }
    } catch (e) {
      // 无效 token
    }
  }

  const start = () => {
    timer = setInterval(checkTokenExpiry, options.checkIntervalMs)
    // 组件挂载时也检查一次
    checkTokenExpiry()
  }

  const stop = () => {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  onMounted(() => start())
  onUnmounted(() => stop())

  return {
    checkTokenExpiry,
    start,
    stop
  }
}
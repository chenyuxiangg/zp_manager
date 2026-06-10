import { ref, onMounted, onUnmounted } from 'vue'
import { useToast } from './useToast'

export function useNetworkError(options = { retryDelay: 3000 }) {
  const toast = useToast()
  const isOffline = ref(!navigator.onLine)
  let retryTimer = null

  const handleOnline = () => {
    isOffline.value = false
    toast.success('网络已恢复')
  }

  const handleOffline = () => {
    isOffline.value = true
    toast.error('网络连接已断开，请检查网络后重试')
  }

  const retry = (callback) => {
    if (isOffline.value) {
      toast.warning('正在等待网络恢复...')
      retryTimer = setTimeout(() => {
        if (navigator.onLine && callback) {
          callback()
        }
      }, options.retryDelay)
    } else if (callback) {
      callback()
    }
  }

  onMounted(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  })

  onUnmounted(() => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
    if (retryTimer) clearTimeout(retryTimer)
  })

  return {
    isOffline,
    retry
  }
}
// B0341 — 统一登出入口 composable
// 3 处 UI 入口（AppHeader 桌面 + AppMobileDrawer 移动端 + Settings 账号 section）
// 共享同一登出逻辑，避免每处复制粘贴 authStore.logout() + router.push('/login')。
//
// API 契约：
//   const { handleLogout, loading } = useLogout()
//   handleLogout() 无参数无返回值；幂等可重复调用
//   失败容错：网络异常后仍跳登录页（fail-open，避免卡死 UI）
//   loading 状态暴露给按钮（AppHeader/Settings 按钮可显示"退出中..."）

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

export function useLogout() {
  const router = useRouter()
  const authStore = useAuthStore()
  const toast = useToast()
  const loading = ref(false)

  async function handleLogout() {
    loading.value = true
    try {
      await authStore.logout()
      router.push('/login')
      toast.success('已退出')
    } catch (e) {
      // logout 内部 try/catch 已 swallow 网络错误，clearLocalAuth 总会执行
      // 此 catch 仅防御意外异常，仍跳登录页避免卡死 UI
      router.push('/login')
    } finally {
      loading.value = false
    }
  }

  return { handleLogout, loading }
}
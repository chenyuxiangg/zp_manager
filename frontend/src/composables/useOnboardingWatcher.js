// v2.18.1 — useOnboardingWatcher
// 目的：合并 App.vue 底部两个分散的 watch（登出清 onboarded + restartOnboarding 启动 tour）
// 行为契约 (test/composables/useOnboardingWatcher.spec.js 守护):
//   - 登出（user 从有变 null）→ 清 localStorage zpersion.onboarded
//   - notify_config.onboarded 从 true 变 false → 1.5s 后 startTour()
//   - 改动其他字段不触发 tour
//   - 不在 setup 上下文调用不爆
//
// 用法 (App.vue):
//   useOnboardingWatcher()  // 无入参，直接在 setup 顶部调一次

import { watch, onUnmounted, getCurrentInstance } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useOnboardingGuide } from '@/composables/useOnboardingGuide'

const ONBOARDED_KEY = 'zpersion.onboarded'
const RESTART_DELAY_MS = 1500

let stopUserWatch = null
let stopOnboardedWatch = null

function safeRemove(key) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

export function useOnboardingWatcher() {
  // 允许在测试或非 setup 上下文调用时不爆
  const inSetup = !!getCurrentInstance()
  const auth = useAuthStore()

  // watch 1: 登出清 onboarded
  stopUserWatch?.()
  stopUserWatch = watch(
    () => auth.user,
    (u, prev) => {
      if (prev && !u) {
        safeRemove(ONBOARDED_KEY)
      }
    }
  )

  // watch 2: onboarded 从 true 变 false → 启动 tour
  stopOnboardedWatch?.()
  let restartTimer = null
  stopOnboardedWatch = watch(
    () => auth.user?.notify_config?.onboarded,
    (newVal, oldVal) => {
      if (oldVal === true && newVal === false) {
        if (restartTimer) clearTimeout(restartTimer)
        const guide = useOnboardingGuide()
        restartTimer = setTimeout(() => {
          guide.startTour()
          restartTimer = null
        }, RESTART_DELAY_MS)
      }
    }
  )

  // onUnmounted 清理（仅在 setup 内注册；非 setup 时跳过）
  if (inSetup) {
    onUnmounted(() => {
      stopUserWatch?.()
      stopOnboardedWatch?.()
      if (restartTimer) clearTimeout(restartTimer)
      stopUserWatch = null
      stopOnboardedWatch = null
    })
  }

  return {
    stop: () => {
      stopUserWatch?.()
      stopOnboardedWatch?.()
      if (restartTimer) clearTimeout(restartTimer)
    },
  }
}
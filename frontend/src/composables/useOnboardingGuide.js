// PR0025 — useOnboardingGuide 委托契约（D2 决策后变薄包装）
// 业务全部下沉到 useOnboardingStore，composable 只做：
//   - shouldShow 4 条件综合判定（与 PR0012 旧契约兼容）
//   - startTour / completeTour / skipTour / restartTour / destroy 委托给 store

import { useOnboardingStore } from '@/stores/onboarding'
import { useAuthStore } from '@/stores/auth'

const ONBOARDED_KEY = 'zpersion.onboarded'
const ONBOARD_WINDOW_MS = 5 * 60 * 1000

function safeGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val) } catch { /* ignore */ }
}
function safeRemove(key) {
  try { localStorage.removeItem(key) } catch { /* ignore */ }
}

export function useOnboardingGuide() {
  const auth = useAuthStore()
  const onboarding = useOnboardingStore()

  function shouldShow() {
    if (safeGet(ONBOARDED_KEY) === 'true') return false
    const user = auth.user
    if (!user) return false
    if (user.notify_config?.onboarded === true) return false
    const createdMs = new Date(user.created_at || 0).getTime()
    if (Number.isNaN(createdMs)) return false
    return (Date.now() - createdMs) < ONBOARD_WINDOW_MS
  }

  function startTour() {
    // KPI-3: 读 server current_step 决定 resumeFrom
    const resumeFrom = onboarding.computeResumeFrom()
    onboarding.startTour({ resumeFrom })
  }

  async function completeTour() {
    safeSet(ONBOARDED_KEY, 'true')
    try { await auth.setOnboarded(true) } catch { /* 静默 */ }
    await onboarding.clearCurrentStep()  // D3 — 清 server current_step
    onboarding.destroy()
  }

  function skipTour() {
    safeSet(ONBOARDED_KEY, 'true')
    // B0324: skip 也算 onboarded 完成（与 complete 一致语义）→ 同步 server
    auth.setOnboarded(true).catch(() => { /* 静默 */ })
    // D3: 清 server current_step（不 await，fire-and-forget）
    onboarding.clearCurrentStep().catch(() => { /* 静默 */ })
    onboarding.destroy()
  }

  function destroy() {
    onboarding.destroy()
  }

  function restartTour() {
    safeRemove(ONBOARDED_KEY)
    onboarding.destroy()
    setTimeout(() => startTour(), 0)
  }

  return { shouldShow, startTour, completeTour, skipTour, destroy, restartTour }
}

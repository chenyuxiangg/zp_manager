// PR0012 — 新用户引导 useOnboardingGuide 复活
// 行为契约 (test/composables/useOnboardingGuide.spec.js 守护):
//   - shouldShow: 4 条件综合 (localStorage + onboarded + created_at < 5min)
//   - startTour: 构造 Driver + defineSteps(5) + start()
//   - completeTour: 写 localStorage + PUT notify-config {onboarded: true}
//   - skipTour: 写 localStorage + 不调 API
//   - 5 步锚点对齐 data-guide="..." 约定

// v2.18: driver.js@1.4.0 仅命名导出 { driver }，无 default — Rollup 构建会报错
import { driver as Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useAuthStore } from '@/stores/auth'
// v2.18: B0303 — 不再 raw api；onboarded 走 authStore.setOnboarded (B0304 统一 PUT 端点)
// B0294: 5 步配置抽到独立文件
import { TOUR_STEPS } from '@/constants/tourSteps'

const ONBOARDED_KEY = 'zpersion.onboarded'  // value: 'true' (字符串) — 与 NewUserGuide 保持一致
const ONBOARD_WINDOW_MS = 5 * 60 * 1000  // 5 分钟

function safeGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val) } catch { /* ignore */ }
}

const STEPS = TOUR_STEPS  // B0294: alias for backward compat (unused, can remove in RR3)

export function useOnboardingGuide() {
  const auth = useAuthStore()
  let driver = null

  function shouldShow() {
    // B0258: 统一 sentinel 'true' (与 NewUserGuide.vue 读法一致)
    if (safeGet(ONBOARDED_KEY) === 'true') return false
    const user = auth.user
    if (!user) return false
    if (user.notify_config?.onboarded === true) return false
    const createdAt = user.created_at
    if (!createdAt) return false
    const createdMs = new Date(createdAt).getTime()
    if (Number.isNaN(createdMs)) return false
    return (Date.now() - createdMs) < ONBOARD_WINDOW_MS
  }

  function startTour() {
    try {
      driver = new Driver({
        className: 'zpersion-tour',
        animate: true,
        opacity: 0.6,
        keyboard: false,
        allowClose: false,
        doneBtnText: '完成',
        nextBtnText: '下一步',
        prevBtnText: '上一步',
      })
      driver.defineSteps(TOUR_STEPS)
      driver.start()
    } catch (e) {
      console.warn('[onboarding] startTour failed', e)
    }
  }

  async function completeTour() {
    // B0258: 统一 sentinel 'true'
    safeSet(ONBOARDED_KEY, 'true')
    try {
      // v2.18: B0303 — 走 authStore.setOnboarded(true) 统一端点 (B0304)
      await auth.setOnboarded(true)
    } catch (e) {
      console.warn('[onboarding] sync onboarded failed', e)
    }
    destroy()
  }

  function skipTour() {
    // B0258: 统一 sentinel 'true'
    safeSet(ONBOARDED_KEY, 'true')
    destroy()
  }

  function destroy() {
    try { driver?.destroy() } catch { /* ignore */ }
    driver = null
  }

  function restartTour() {
    // B0258: 'false' 走 safeRemove (与 shouldShow 的 === 'true' 检查对齐)
    try { localStorage.removeItem(ONBOARDED_KEY) } catch { /* ignore */ }
    destroy()
    setTimeout(() => startTour(), 0)
  }

  return { shouldShow, startTour, completeTour, skipTour, destroy, restartTour, steps: TOUR_STEPS }
}

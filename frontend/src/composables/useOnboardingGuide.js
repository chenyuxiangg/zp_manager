// PR0025 — useOnboardingGuide 委托契约（D2 决策后变薄包装）
// 业务全部下沉到 useOnboardingStore，composable 只做：
//   - shouldShow 4 条件综合判定（与 PR0012 旧契约兼容）
//   - startTour / completeTour / skipTour / restartTour / destroy 委托给 store
//
// B0351: 跨页路由跳车 — TOUR_STEPS 中 nextRoute 字段表示此步"下一步"需要
// router.push 到对应路由后等 anchor 入 DOM 再 driver.drive(idx+1)。
// 在 composable 层注入（store 不直接依赖 router，避免测试时 createRouter
// 解析失败的副作用）。

import { useOnboardingStore } from '@/stores/onboarding'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { TOUR_STEPS } from '@/constants/tourSteps'

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

/**
 * 给 TOUR_STEPS 注入跨页路由跳车的 popover.onNextClick
 * - 对含 nextRoute 字段的 step，onNextClick 跳路由 + 等 anchor 入 DOM 再 driver.drive(idx+1)
 * - 移除 nextRoute 字段（driver 不识别）
 * - 其余 step 原样返回
 */
function instrumentStepsWithRouter(steps, router) {
  return steps.map((step, idx) => {
    if (!step.nextRoute) return step
    const nextSelector = steps[idx + 1]?.element
    if (!nextSelector || !router) return step
    const { nextRoute: _omit, ...cleanStep } = step
    return {
      ...cleanStep,
      popover: {
        ...cleanStep.popover,
        onNextClick: (_element, _stepOpts, opts) => {
          router.push(step.nextRoute)
          const tryDrive = (retriesLeft = 50) => {
            if (typeof document === 'undefined') return
            if (document.querySelector(nextSelector)) {
              opts.driver.drive(idx + 1)
            } else if (retriesLeft > 0) {
              setTimeout(() => tryDrive(retriesLeft - 1), 50)
            }
          }
          tryDrive()
        },
      },
    }
  })
}

export function useOnboardingGuide() {
  const auth = useAuthStore()
  const onboarding = useOnboardingStore()
  // 可选：允许测试/特殊调用场景在 useOnboardingGuide() 内部不依赖 setup
  // 内 useRouter 时仍能工作（fallback 不注入跨页跳车）
  let router = null
  try { router = useRouter() } catch { /* 非 setup 上下文 fall-through */ }

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
    // B0351: 注入跨页路由跳车的 step
    const steps = instrumentStepsWithRouter(TOUR_STEPS, router)
    onboarding.startTour({ resumeFrom, steps })
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

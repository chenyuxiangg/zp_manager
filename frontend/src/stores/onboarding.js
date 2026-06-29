// PR0025 — onboarding pinia store (D2 决策)
// 职责:
//   - 持有 driver 单例（D2：让 router / composable / 测试三方都能访问）
//   - driver 生命周期 + onHighlighted hook 自动持久化 current_step（B0033 D1 A 路径）
//   - clearCurrentStep（D3：onboarded=true 时清步）
//   - computeResumeFrom（KPI-3：从 server current_step 决定续走起点）
//
// driver 是模块级单例（不是 store state）：driver 跟路由生命周期独立，store 销毁 driver 不灭。
// store action 只负责"业务逻辑 + 同步 store 镜像"。

import { defineStore } from 'pinia'
import { driver as Driver } from 'driver.js'
import { TOUR_STEPS } from '@/constants/tourSteps'
import { useAuthStore } from '@/stores/auth'

// 模块级单例（测试需在 beforeEach 显式 destroy）
let driver = null

export const useOnboardingStore = defineStore('onboarding', {
  state: () => ({
    active: false,           // driver.isActive 镜像
    activeIndex: 0,          // driver.getActiveIndex 镜像
    resumeFrom: 0,           // computeResumeFrom 缓存（KPI-3）
  }),
  actions: {
    /**
     * 启动 driver.js tour
     * @param {Object} opts
     * @param {number} opts.resumeFrom - 0=从头；>=1=跳到该步（driver.drive）
     */
    startTour({ resumeFrom = 0 } = {}) {
      // 已有 driver 先 destroy，避免单例累积
      if (driver) {
        try { driver.destroy() } catch { /* ignore */ }
        driver = null
      }

      driver = new Driver({
        className: 'zpersion-tour',
        animate: true,
        opacity: 0.6,
        keyboard: false,
        allowClose: false,
        doneBtnText: '完成',
        nextBtnText: '下一步',
        prevBtnText: '上一步',
        onHighlighted: () => {
          // B0033 D1 A：每步高亮立即持久化 current_step
          const idx = driver.getActiveIndex?.() ?? 0
          this.activeIndex = idx
          this.active = true
          this.persistCurrentStep(idx).catch(() => { /* 静默 */ })
        },
        onDestroyed: () => {
          this.active = false
          this.activeIndex = 0
        },
      })
      driver.defineSteps(TOUR_STEPS)
      // 越界防御：resumeFrom 必须 0..TOUR_STEPS.length-1
      if (typeof resumeFrom === 'number' && resumeFrom >= 1 && resumeFrom < TOUR_STEPS.length) {
        driver.drive(resumeFrom)
      } else {
        driver.start()
      }
    },

    destroy() {
      try { driver?.destroy() } catch { /* ignore */ }
      driver = null
      this.active = false
      this.activeIndex = 0
    },

    /** B0033 D1 — 同步 current_step 到 server */
    async persistCurrentStep(stepIndex) {
      const auth = useAuthStore()
      if (!auth.user) return
      try {
        await auth.updateNotifyConfig({ current_step: stepIndex })
      } catch (e) {
        // 静默失败：下次 onHighlighted 会重写
        console.warn('[onboarding] persistCurrentStep failed', e)
      }
    },

    /** D3 — 清空 server 上的 current_step（onboarded=true 时调用） */
    async clearCurrentStep() {
      const auth = useAuthStore()
      if (!auth.user) return
      try {
        await auth.updateNotifyConfig({ current_step: null })
      } catch (e) {
        console.warn('[onboarding] clearCurrentStep failed', e)
      }
    },

    /** KPI-3 — 从 server 读 current_step 决定 resumeFrom */
    computeResumeFrom() {
      const auth = useAuthStore()
      const cs = auth.user?.notify_config?.current_step
      if (typeof cs === 'number' && cs >= 1 && cs < TOUR_STEPS.length) {
        this.resumeFrom = cs
      } else {
        this.resumeFrom = 0
      }
      return this.resumeFrom
    },
  },
})

/** 模块级 driver accessor — router afterEach 用 */
export function getDriverInstance() {
  return driver
}

export function isOnboardingActive() {
  return driver?.isActive?.() === true
}

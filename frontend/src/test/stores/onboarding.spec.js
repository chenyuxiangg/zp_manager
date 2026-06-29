// PR0025 — onboarding pinia store 契约
// 守护 3 个 KPI:
//   B0033 — onHighlighted → persistCurrentStep → updateNotifyConfig({current_step: N})
//   B0119 — driver 模块级单例，destroy 由 store 接管
//   派生(KPI-3) — computeResumeFrom 决定 startTour 的 resumeFrom 入参
//
// 注意: driver 是模块级单例（store 销毁 driver 不灭），必须在 beforeEach 显式 destroy

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// mock driver.js — 命名导出 { driver }
const driverStartMock = vi.fn()
const driverDestroyMock = vi.fn()
const driverDriveMock = vi.fn()
const driverDefineStepsMock = vi.fn()
const driverGetActiveIndexMock = vi.fn(() => 0)
const driverInstance = {
  start: driverStartMock,
  destroy: driverDestroyMock,
  drive: driverDriveMock,
  defineSteps: driverDefineStepsMock,
  getActiveIndex: driverGetActiveIndexMock,
  isActive: vi.fn(() => true),
}
const DriverMock = vi.fn(() => driverInstance)
vi.mock('driver.js', () => ({ driver: DriverMock }))

// mock authStore
const updateNotifyConfigMock = vi.fn()
const authState = { user: null }
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get user() { return authState.user },
    updateNotifyConfig: updateNotifyConfigMock,
  }),
}))

// mock tourSteps 保持原文件不动，引用真模块
// 但 vitest 默认会真导入，需要前确保 module 存在
// 不 mock，引用真实常量

describe('PR0025 — useOnboardingStore', () => {
  beforeEach(() => {
    DriverMock.mockClear()
    driverStartMock.mockReset()
    driverDestroyMock.mockReset()
    driverDriveMock.mockReset()
    driverDefineStepsMock.mockReset()
    driverGetActiveIndexMock.mockReset()
    driverGetActiveIndexMock.mockReturnValue(0)
    driverInstance.isActive.mockReset()
    driverInstance.isActive.mockReturnValue(true)
    updateNotifyConfigMock.mockReset()
    updateNotifyConfigMock.mockResolvedValue({ success: true })
    authState.user = null
    setActivePinia(createPinia())
  })

  // ============ KPI-3 — startTour resumeFrom 入参 ============

  it('startTour({ resumeFrom: 0 }) → driver.start() 被调，drive() 不被调', async () => {
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    store.startTour({ resumeFrom: 0 })
    expect(driverStartMock).toHaveBeenCalledTimes(1)
    expect(driverDriveMock).not.toHaveBeenCalled()
  })

  it('startTour({ resumeFrom: 2 }) → driver.drive(2) 被调，start() 不被调', async () => {
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    store.startTour({ resumeFrom: 2 })
    expect(driverDriveMock).toHaveBeenCalledWith(2)
    expect(driverStartMock).not.toHaveBeenCalled()
  })

  it('startTour({ resumeFrom: 99 })（越界） → 回退到 driver.start()，不抛错', async () => {
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    expect(() => store.startTour({ resumeFrom: 99 })).not.toThrow()
    expect(driverStartMock).toHaveBeenCalledTimes(1)
  })

  // ============ KPI-1 — onHighlighted hook → persistCurrentStep ============

  it('onHighlighted 触发 → store 镜像 activeIndex=N + persistCurrentStep(N) 被调', async () => {
    authState.user = { id: 1, notify_config: { current_step: null } }
    // 拿到 startTour 时传入 Driver 的 onHighlighted callback
    let capturedHook = null
    DriverMock.mockImplementation((opts) => {
      capturedHook = opts.onHighlighted
      return driverInstance
    })

    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    store.startTour({ resumeFrom: 0 })

    driverGetActiveIndexMock.mockReturnValue(3)
    capturedHook()  // 模拟 driver.js 触发 hook
    // micro-task drain: persistCurrentStep 是 async Promise chain
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()

    expect(store.activeIndex).toBe(3)
    expect(store.active).toBe(true)
    expect(updateNotifyConfigMock).toHaveBeenCalledWith({ current_step: 3 })
  })

  it('onDestroyed 触发 → store.active=false + activeIndex=0', async () => {
    let capturedHook = null
    DriverMock.mockImplementation((opts) => {
      capturedHook = opts.onDestroyed
      return driverInstance
    })

    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    store.startTour({ resumeFrom: 0 })
    driverGetActiveIndexMock.mockReturnValue(2)
    capturedHook()  // 此时 store 还没镜像 index

    expect(store.active).toBe(false)
    expect(store.activeIndex).toBe(0)
  })

  // ============ KPI-1 — persistCurrentStep / clearCurrentStep ============

  it('persistCurrentStep(3) → updateNotifyConfig({ current_step: 3 })', async () => {
    authState.user = { id: 1, notify_config: {} }
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    await store.persistCurrentStep(3)
    expect(updateNotifyConfigMock).toHaveBeenCalledWith({ current_step: 3 })
  })

  it('clearCurrentStep() → updateNotifyConfig({ current_step: null })', async () => {
    authState.user = { id: 1, notify_config: {} }
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    await store.clearCurrentStep()
    expect(updateNotifyConfigMock).toHaveBeenCalledWith({ current_step: null })
  })

  it('persistCurrentStep 无 user → 不调 updateNotifyConfig（静默）', async () => {
    authState.user = null
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    await expect(store.persistCurrentStep(2)).resolves.toBeUndefined()
    expect(updateNotifyConfigMock).not.toHaveBeenCalled()
  })

  // ============ KPI-3 — computeResumeFrom 决定续走步 ============

  it('computeResumeFrom — user.current_step=2 → resumeFrom=2', async () => {
    authState.user = { notify_config: { current_step: 2 } }
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    expect(store.computeResumeFrom()).toBe(2)
    expect(store.resumeFrom).toBe(2)
  })

  it('computeResumeFrom — user.current_step=99（越界） → resumeFrom=0', async () => {
    authState.user = { notify_config: { current_step: 99 } }
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    expect(store.computeResumeFrom()).toBe(0)
  })

  it('computeResumeFrom — user.current_step=null → resumeFrom=0', async () => {
    authState.user = { notify_config: { current_step: null } }
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    expect(store.computeResumeFrom()).toBe(0)
  })

  // ============ KPI-1/B0119 — destroy 接管 driver 单例 ============

  it('destroy() → driver.destroy 被调 + store.active=false', async () => {
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    store.startTour({ resumeFrom: 0 })
    store.destroy()
    expect(driverDestroyMock).toHaveBeenCalled()
    expect(store.active).toBe(false)
    expect(store.activeIndex).toBe(0)
  })

  it('startTour 二次调用 → 上一个 driver 先 destroy（避免残留）', async () => {
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    store.startTour({ resumeFrom: 0 })
    driverDestroyMock.mockClear()
    store.startTour({ resumeFrom: 1 })
    expect(driverDestroyMock).toHaveBeenCalledTimes(1)
  })
})

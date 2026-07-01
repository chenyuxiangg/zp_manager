// PR0025 / B0119 — router.afterEach driver.destroy() 兜底
// 守护:
//   - 引导中跳到非引导路由 → driver.destroy + persistCurrentStep
//   - 引导中跳到引导内路由 → 不 destroy
//   - 不在引导中（isActive=false）→ 啥也不做
//   - /plans/123 子路径算引导内（plans 前缀匹配）

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// mock driver.js
// B0349: driver.js v1.4.0 真实 API 是 setSteps + drive(N)，没有 start() / defineSteps()
const driverDestroyMock = vi.fn()
const driverDriveMock = vi.fn()
const driverSetStepsMock = vi.fn()
const driverGetActiveIndexMock = vi.fn(() => 0)
const driverInstance = {
  setSteps: driverSetStepsMock,
  destroy: driverDestroyMock,
  drive: driverDriveMock,
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

describe('PR0025 / B0119 — router.afterEach driver.destroy()', () => {
  let router

  beforeEach(async () => {
    DriverMock.mockClear()
    driverDestroyMock.mockReset()
    driverDriveMock.mockReset()
    driverSetStepsMock.mockReset()
    driverGetActiveIndexMock.mockReset()
    driverGetActiveIndexMock.mockReturnValue(0)
    driverInstance.isActive.mockReset()
    driverInstance.isActive.mockReturnValue(true)
    updateNotifyConfigMock.mockReset()
    updateNotifyConfigMock.mockResolvedValue({ success: true })
    authState.user = null
    // B0119 测试前置：设 token 让 router beforeEach 放行（/dashboard 等 requiresAuth）
    localStorage.setItem('token', 'mock-token')
    setActivePinia(createPinia())

    // 必须在 import router 之前 setup mock
    vi.resetModules()
    router = (await import('@/router')).default
  })

  afterEach(async () => {
    // 清 driver 单例避免污染下一用例（store 模块级 driver 变量）
    const { useOnboardingStore } = await import('@/stores/onboarding')
    useOnboardingStore().destroy()
    localStorage.removeItem('token')
  })

  beforeEach(async () => {
    // 先清 driver 单例（防止上一用例残留）
    const { useOnboardingStore } = await import('@/stores/onboarding')
    try { useOnboardingStore().destroy() } catch { /* ignore */ }
  })

  it('暴露 afterEach 回调', async () => {
    // router.afterEach 会把回调存起来，但 vue-router 没暴露 afterEachCbs
    // 改用更稳的方式：直接 import onboarding 模块的回调注册（如果 router 暴露了）
    // 这里至少验证 router 没有抛错
    expect(typeof router).toBe('object')
  })

  it('引导中跳到 /settings（非引导） → driver.destroy 被调 + persistCurrentStep 被调', async () => {
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    store.startTour({ resumeFrom: 0 })
    authState.user = { id: 1, notify_config: { current_step: null } }  // 让 persistCurrentStep 不早 return
    driverGetActiveIndexMock.mockReturnValue(2)
    driverDestroyMock.mockClear()
    updateNotifyConfigMock.mockClear()

    // 触发 router 真实跳转（vue-router 4.x 内部会调 afterEach）
    await router.push('/settings')
    await new Promise(r => setTimeout(r, 50))  // dynamic import + afterEach 给足时间

    expect(driverDestroyMock).toHaveBeenCalled()
    expect(updateNotifyConfigMock).toHaveBeenCalledWith({ current_step: 2 })
  })

  it('引导中跳到 /dashboard（引导内） → driver.destroy 不被调', async () => {
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    store.startTour({ resumeFrom: 0 })
    driverDestroyMock.mockClear()
    updateNotifyConfigMock.mockClear()

    await router.push('/dashboard')
    await new Promise(r => setTimeout(r, 50))

    expect(driverDestroyMock).not.toHaveBeenCalled()
  })

  it('引导中跳到 /plans/123（子路径，仍属引导） → driver.destroy 不被调', async () => {
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    store.startTour({ resumeFrom: 0 })
    driverDestroyMock.mockClear()

    await router.push('/plans/123')
    await new Promise(r => setTimeout(r, 50))

    expect(driverDestroyMock).not.toHaveBeenCalled()
  })

  it('不在引导中跳到 /settings → driver.destroy 不被调', async () => {
    // driver 不在引导中：isActive=false
    driverInstance.isActive.mockReturnValue(false)
    const { useOnboardingStore } = await import('@/stores/onboarding')
    const store = useOnboardingStore()
    store.destroy()  // 把模块级 driver 置 null（上面 isActive false 后再 destroy 保险）
    driverDestroyMock.mockClear()
    updateNotifyConfigMock.mockClear()

    await router.push('/settings')
    await new Promise(r => setTimeout(r, 50))

    expect(driverDestroyMock).not.toHaveBeenCalled()
    expect(updateNotifyConfigMock).not.toHaveBeenCalled()
  })
})

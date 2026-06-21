// PR0012 — 新用户引导 useOnboardingGuide 复活
// 目标: 锁定 5 个行为契约
//   1) shouldShow 综合判定 (localStorage + onboarded + created_at + 5min 窗口)
//   2) startTour 调 driver.js
//   3) completeTour 写 localStorage + PUT notify-config
//   4) skipTour 写 localStorage + 不调 API (用户跳过)
//   5) 5 步定义完整且 element 锚点对齐方案

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

// mock driver.js — driver.js@1.4.0 命名导出 { driver }，无 default
// 之前 v2.17 漏报：测试用 default mock 掩盖了真实库的命名导入，build 时 Rollup 报错
// 现锁定真契约：import { driver as Driver } from 'driver.js'
const driverStartMock = vi.fn()
const driverDestroyMock = vi.fn()
const driverMoveNextMock = vi.fn()
const driverMovePrevMock = vi.fn()
const driverDefineStepsMock = vi.fn()
const driverInstance = {
  start: driverStartMock,
  destroy: driverDestroyMock,
  moveNext: driverMoveNextMock,
  movePrevious: driverMovePrevMock,
  defineSteps: driverDefineStepsMock,
  isActivated: false,
}
const DriverMock = vi.fn(() => driverInstance)
vi.mock('driver.js', () => ({ driver: DriverMock }))

// mock authStore — B0303 后 onboarded 走 authStore.setOnboarded (不再 raw api)
const setOnboardedMock = vi.fn()
const authState = { user: null }
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get user() { return authState.user },
    setOnboarded: setOnboardedMock,
  }),
}))

const ONBOARDED_KEY = 'zpersion.onboarded'

describe('PR0012 — useOnboardingGuide 5 步契约', () => {
  beforeEach(() => {
    DriverMock.mockClear()
    driverStartMock.mockReset()
    driverDestroyMock.mockReset()
    driverMoveNextMock.mockReset()
    driverDefineStepsMock.mockReset()
    setOnboardedMock.mockReset()
    authState.user = null
    localStorage.removeItem(ONBOARDED_KEY)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  it('【shouldShow】localStorage 空 + 新用户 → true', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    authState.user = {
      created_at: '2026-06-15T11:58:00Z',  // 2 分钟前
      notify_config: { onboarded: false },
    }
    const g = useOnboardingGuide()
    expect(g.shouldShow()).toBe(true)
  })

  it('【shouldShow】localStorage 已有 onboarded=true → false', async () => {
    localStorage.setItem(ONBOARDED_KEY, 'true')
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    authState.user = {
      created_at: '2026-06-15T11:58:00Z',
      notify_config: { onboarded: false },
    }
    const g = useOnboardingGuide()
    expect(g.shouldShow()).toBe(false)
  })

  it('【shouldShow】server notify_config.onboarded=true → false', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    authState.user = {
      created_at: '2026-06-15T11:58:00Z',
      notify_config: { onboarded: true },
    }
    const g = useOnboardingGuide()
    expect(g.shouldShow()).toBe(false)
  })

  it('【shouldShow】用户创建超 5 分钟 → false', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    authState.user = {
      created_at: '2026-06-15T11:00:00Z',  // 60 分钟前
      notify_config: { onboarded: false },
    }
    const g = useOnboardingGuide()
    expect(g.shouldShow()).toBe(false)
  })

  it('【startTour】构造 Driver + defineSteps(5) + start()', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    const g = useOnboardingGuide()
    g.startTour()
    expect(DriverMock).toHaveBeenCalledTimes(1)
    expect(driverDefineStepsMock).toHaveBeenCalledTimes(1)
    const steps = driverDefineStepsMock.mock.calls[0][0]
    expect(steps.length).toBe(5)
    expect(driverStartMock).toHaveBeenCalledTimes(1)
  })

  it('【completeTour】写 localStorage + 调 authStore.setOnboarded(true) (B0303+ B0304)', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    const g = useOnboardingGuide()
    setOnboardedMock.mockResolvedValue({ success: true })
    await g.completeTour()
    expect(localStorage.getItem(ONBOARDED_KEY)).toBe('true')
    expect(setOnboardedMock).toHaveBeenCalledWith(true)
  })

  it('【skipTour】写 localStorage + 不调 store action', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    const g = useOnboardingGuide()
    g.skipTour()
    expect(localStorage.getItem(ONBOARDED_KEY)).toBe('true')
    expect(setOnboardedMock).not.toHaveBeenCalled()
  })

  it('【5 步锚点】步骤 element 引用方案约定的 5 个 data-guide 锚点', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    const g = useOnboardingGuide()
    g.startTour()
    const steps = driverDefineStepsMock.mock.calls[0][0]
    const expected = [
      'data-guide="welcome"',                  // step 1: 欢迎
      'data-guide="nav-plans"',                // step 2: 创建计划
      'data-guide="plan-detail"',              // step 3: 拆分阶段/任务
      'data-guide="task-toggle"',              // step 4: 完成任务
      'data-guide="nav-reports"',              // step 5: 看报表
    ]
    for (let i = 0; i < expected.length; i++) {
      expect(steps[i].element).toContain(expected[i].split('=')[1].replace(/"/g, ''))
    }
  })
})

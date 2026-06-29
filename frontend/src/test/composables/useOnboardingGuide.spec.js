// PR0025 — useOnboardingGuide 委托契约 + shouldShow
// 守护:
//   - 5 个 shouldShow 用例（接口签名兼容，不动）
//   - startTour → onboarding store.startTour() 被调
//   - completeTour → localStorage + setOnboarded + clearCurrentStep 全调（D3 清步）
//   - skipTour → localStorage + setOnboarded + clearCurrentStep 全调（D3 清步；与旧契约"不调 API"不同，本 PR 顺手对齐 B0324）

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// mock onboarding store（D2 决策：composable 只做 thin wrapper）
const storeStartTourMock = vi.fn()
const storeDestroyMock = vi.fn()
const storeClearCurrentStepMock = vi.fn()
const storeComputeResumeFromMock = vi.fn(() => 0)
vi.mock('@/stores/onboarding', () => ({
  useOnboardingStore: () => ({
    startTour: storeStartTourMock,
    destroy: storeDestroyMock,
    clearCurrentStep: storeClearCurrentStepMock,
    computeResumeFrom: storeComputeResumeFromMock,
  }),
}))

// mock authStore
const setOnboardedMock = vi.fn()
const authState = { user: null }
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get user() { return authState.user },
    setOnboarded: setOnboardedMock,
  }),
}))

const ONBOARDED_KEY = 'zpersion.onboarded'

describe('PR0025 — useOnboardingGuide 委托契约', () => {
  beforeEach(() => {
    storeStartTourMock.mockReset()
    storeDestroyMock.mockReset()
    storeClearCurrentStepMock.mockReset().mockResolvedValue(undefined)
    storeComputeResumeFromMock.mockReset().mockReturnValue(0)
    setOnboardedMock.mockReset().mockResolvedValue({ success: true })
    authState.user = null
    localStorage.removeItem(ONBOARDED_KEY)
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-22T12:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  // ============ shouldShow 5 用例（接口兼容）============

  it('【shouldShow】localStorage 空 + 新用户 → true', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    authState.user = {
      created_at: '2026-06-22T11:58:00Z',
      notify_config: { onboarded: false },
    }
    const g = useOnboardingGuide()
    expect(g.shouldShow()).toBe(true)
  })

  it('【shouldShow】localStorage 已有 onboarded=true → false', async () => {
    localStorage.setItem(ONBOARDED_KEY, 'true')
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    authState.user = {
      created_at: '2026-06-22T11:58:00Z',
      notify_config: { onboarded: false },
    }
    const g = useOnboardingGuide()
    expect(g.shouldShow()).toBe(false)
  })

  it('【shouldShow】server notify_config.onboarded=true → false', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    authState.user = {
      created_at: '2026-06-22T11:58:00Z',
      notify_config: { onboarded: true },
    }
    const g = useOnboardingGuide()
    expect(g.shouldShow()).toBe(false)
  })

  it('【shouldShow】用户创建超 5 分钟 → false', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    authState.user = {
      created_at: '2026-06-22T11:00:00Z',
      notify_config: { onboarded: false },
    }
    const g = useOnboardingGuide()
    expect(g.shouldShow()).toBe(false)
  })

  it('【shouldShow】user 缺失 → false（fetchUser 还没回）', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    authState.user = null
    const g = useOnboardingGuide()
    expect(g.shouldShow()).toBe(false)
  })

  // ============ 委托契约 ============

  it('【startTour】委托给 store.startTour({ resumeFrom: computeResumeFrom() })', async () => {
    storeComputeResumeFromMock.mockReturnValue(3)
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    const g = useOnboardingGuide()
    g.startTour()
    expect(storeComputeResumeFromMock).toHaveBeenCalled()
    expect(storeStartTourMock).toHaveBeenCalledWith({ resumeFrom: 3 })
  })

  it('【completeTour】localStorage + setOnboarded(true) + clearCurrentStep + store.destroy', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    const g = useOnboardingGuide()
    await g.completeTour()
    expect(localStorage.getItem(ONBOARDED_KEY)).toBe('true')
    expect(setOnboardedMock).toHaveBeenCalledWith(true)
    expect(storeClearCurrentStepMock).toHaveBeenCalled()
    expect(storeDestroyMock).toHaveBeenCalled()
  })

  it('【skipTour】localStorage + setOnboarded(true) + clearCurrentStep + store.destroy（D3 + B0324）', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    const g = useOnboardingGuide()
    g.skipTour()
    // micro-task drain（setOnboarded + clearCurrentStep 都是 fire-and-forget Promise）
    // fakeTimers 下不能用 setTimeout(r, 0)，改用 vi.advanceTimersByTimeAsync
    await vi.advanceTimersByTimeAsync(10)
    expect(localStorage.getItem(ONBOARDED_KEY)).toBe('true')
    expect(setOnboardedMock).toHaveBeenCalledWith(true)
    expect(storeClearCurrentStepMock).toHaveBeenCalled()
    expect(storeDestroyMock).toHaveBeenCalled()
  })

  it('【restartTour】清 localStorage + 重新 startTour', async () => {
    localStorage.setItem(ONBOARDED_KEY, 'true')
    storeComputeResumeFromMock.mockReturnValue(0)
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    const g = useOnboardingGuide()
    g.restartTour()
    // restartTour 内 setTimeout(() => startTour(), 0)，advance timers 触发
    await vi.advanceTimersByTimeAsync(10)
    expect(localStorage.getItem(ONBOARDED_KEY)).toBeNull()
    expect(storeStartTourMock).toHaveBeenCalled()
  })

  it('【destroy】直接委托 store.destroy', async () => {
    const { useOnboardingGuide } = await import('@/composables/useOnboardingGuide')
    const g = useOnboardingGuide()
    g.destroy()
    expect(storeDestroyMock).toHaveBeenCalled()
  })
})

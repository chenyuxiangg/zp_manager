// v2.18.1 — useOnboardingWatcher composable 契约
// 目的：合并 App.vue 底部两个分散的 watch（登出清 onboarded + restartOnboarding 启动 tour）
// 抽到 composable 后 App.vue setup 底部可读性提升，逻辑正交保持不变

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'

// mock 关键依赖
const startTourMock = vi.fn()

// 必须在 mock factory 外部建立 ref
const userRef = ref(null)

vi.mock('@/composables/useOnboardingGuide', () => ({
  useOnboardingGuide: () => ({
    startTour: startTourMock,
  }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get user() { return userRef.value },
  }),
}))

describe('【v2.18.1 useOnboardingWatcher】', () => {
  beforeEach(() => {
    startTourMock.mockReset()
    userRef.value = null
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('导出 watchAuthOnboarding() 函数（无入参，直接调）', async () => {
    const mod = await import('@/composables/useOnboardingWatcher')
    expect(typeof mod.useOnboardingWatcher).toBe('function')
  })

  it('登出（user 从对象变 null）→ 清 localStorage zpersion.onboarded', async () => {
    userRef.value = { id: 1, username: 'me' }
    localStorage.setItem('zpersion.onboarded', 'true')

    const { useOnboardingWatcher } = await import('@/composables/useOnboardingWatcher')
    useOnboardingWatcher()
    await nextTick()

    // 触发登出
    userRef.value = null
    await nextTick()

    expect(localStorage.getItem('zpersion.onboarded')).toBeNull()
  })

  it('已登录状态下 onMounted 不会清 onboarded', async () => {
    userRef.value = { id: 1, username: 'me' }
    localStorage.setItem('zpersion.onboarded', 'true')

    const { useOnboardingWatcher } = await import('@/composables/useOnboardingWatcher')
    useOnboardingWatcher()
    await nextTick()

    // 不应清（user 没从有变 null）
    expect(localStorage.getItem('zpersion.onboarded')).toBe('true')
  })

  it('onboarded 从 true 变 false → 1.5s 后 startTour()', async () => {
    userRef.value = {
      id: 1, username: 'me',
      notify_config: { onboarded: true },
    }
    const { useOnboardingWatcher } = await import('@/composables/useOnboardingWatcher')
    useOnboardingWatcher()
    await nextTick()
    startTourMock.mockClear()

    // 模拟 setOnboarded(false)
    userRef.value = {
      ...userRef.value,
      notify_config: { onboarded: false },
    }
    await nextTick()
    vi.advanceTimersByTime(1500)

    expect(startTourMock).toHaveBeenCalledTimes(1)
  })

  it('onboarded 保持 true → 不 startTour', async () => {
    userRef.value = {
      id: 1, username: 'me',
      notify_config: { onboarded: true },
    }
    const { useOnboardingWatcher } = await import('@/composables/useOnboardingWatcher')
    useOnboardingWatcher()
    await nextTick()
    startTourMock.mockClear()

    // 改其他字段
    userRef.value = {
      ...userRef.value,
      notify_config: { onboarded: true, other: 1 },
    }
    await nextTick()
    vi.advanceTimersByTime(2000)

    expect(startTourMock).not.toHaveBeenCalled()
  })

  it('onUnmounted 时清 onboarded 状态不会爆（双保险：onMounted 已有 onUnmounted）', async () => {
    userRef.value = null
    const { useOnboardingWatcher } = await import('@/composables/useOnboardingWatcher')
    expect(() => useOnboardingWatcher()).not.toThrow()
  })
})
// PR0025 / KPI-3 — App.vue onMounted 后从 server current_step 续走
// 守护:
//   - mount App.vue 后 auth.fetchUser 返回 current_step=2 → driver.drive(2) 被调（不是 start()）
//   - 5 分钟窗口外 → driver 不启动
//   - onHighlighted 触发 → updateNotifyConfig({current_step: N}) 被调（幂等）

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'

// mock driver.js
// B0349: driver.js v1.4.0 真实 API 是 setSteps + drive(N)，没有 start() / defineSteps()
const driverDestroyMock = vi.fn()
const driverDriveMock = vi.fn()
const driverSetStepsMock = vi.fn()
const driverGetActiveIndexMock = vi.fn(() => 0)
let capturedOnHighlighted = null
const driverInstance = {
  setSteps: driverSetStepsMock,
  destroy: driverDestroyMock,
  drive: driverDriveMock,
  getActiveIndex: driverGetActiveIndexMock,
  isActive: vi.fn(() => true),
}
const DriverMock = vi.fn((opts) => {
  capturedOnHighlighted = opts?.onHighlighted || null
  return driverInstance
})
vi.mock('driver.js', () => ({ driver: DriverMock }))

// mock authStore
const fetchUserMock = vi.fn()
const updateNotifyConfigMock = vi.fn()
const authState = { user: null }
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    get user() { return authState.user },
    set user(v) { authState.user = v },
    fetchUser: fetchUserMock,
    updateNotifyConfig: updateNotifyConfigMock,
  }),
}))

// mock router — App.vue setup 里可能访问
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), currentRoute: { value: { path: '/dashboard' } } }),
  useRoute: () => ({ path: '/dashboard' }),
}))

// mock 子组件 — 只关心 App.vue 的 onMounted 行为，layout 子组件不重要
vi.mock('@/components/layout/AppLayout.vue', () => ({ default: { template: '<div><slot/></div>' } }))
vi.mock('@/components/layout/AuthLayout.vue', () => ({ default: { template: '<div><slot/></div>' } }))
vi.mock('@/components/common/Toast.vue', () => ({ default: { template: '<div/>' } }))
vi.mock('@/components/common/CelebrationEffect.vue', () => ({ default: { template: '<div/>' } }))
vi.mock('@/components/common/PointsFloat.vue', () => ({ default: { template: '<div/>' } }))

// mock 其他 composables（App.vue setup 内调）
vi.mock('@/composables/useTheme', () => ({
  useTheme: vi.fn(),
  provideTheme: vi.fn(),
}))
vi.mock('@/composables/useFeedback', () => ({
  provideFeedback: vi.fn(() => ({ event: null })),
  FEEDBACK_KEY: Symbol('feedback'),
}))
vi.mock('@/composables/useTokenExpiry', () => ({
  useTokenExpiry: vi.fn(),
}))
vi.mock('@/composables/useOnboardingWatcher', () => ({
  useOnboardingWatcher: vi.fn(),
}))

describe('PR0025 / KPI-3 — App.vue 集成：从 server current_step 续走', () => {
  beforeEach(() => {
    DriverMock.mockClear()
    driverDestroyMock.mockReset()
    driverDriveMock.mockReset()
    driverSetStepsMock.mockReset()
    driverGetActiveIndexMock.mockReset()
    driverGetActiveIndexMock.mockReturnValue(0)
    capturedOnHighlighted = null

    fetchUserMock.mockReset()
    updateNotifyConfigMock.mockReset()
    updateNotifyConfigMock.mockResolvedValue({ success: true })
    authState.user = null

    localStorage.removeItem('zpersion.onboarded')
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-22T12:00:00Z'))
  })
  afterEach(() => { vi.useRealTimers() })

  it('【续走】fetchUser 返回 current_step=2 + 5min 内 → driver.drive(2) 被调', async () => {
    authState.user = {
      id: 1,
      username: 'me',
      created_at: '2026-06-22T11:58:00Z',  // 2 分钟前
      notify_config: { onboarded: false, current_step: 2 },
    }
    fetchUserMock.mockResolvedValue({ success: true })

    const App = (await import('@/App.vue')).default
    mount(App, {
      global: {
        plugins: [createPinia()],
        stubs: { 'router-view': true },  // 避免 happy-dom 下 router-view slot 渲染失败
      },
    })
    // onMounted 是 async，等 setTimeout 1500ms 触发 startTour
    await vi.advanceTimersByTimeAsync(2000)

    expect(driverDriveMock).toHaveBeenCalledWith(2)
    // B0349: 不再调 start()（v1.4.0 没有 start()）
    expect(driverDriveMock).not.toHaveBeenCalledWith(0)
  })

  it('【首次】fetchUser 返回 current_step=null → driver.drive(0) 被调（从头开始）', async () => {
    authState.user = {
      id: 1,
      username: 'me',
      created_at: '2026-06-22T11:58:00Z',
      notify_config: { onboarded: false, current_step: null },
    }
    fetchUserMock.mockResolvedValue({ success: true })

    const App = (await import('@/App.vue')).default
    mount(App, {
      global: {
        plugins: [createPinia()],
        stubs: { 'router-view': true },
      },
    })
    await vi.advanceTimersByTimeAsync(2000)

    // B0349: driver.js v1.4.0 用 drive(0) 代替 v0.x 的 start()
    expect(driverDriveMock).toHaveBeenCalledWith(0)
  })

  it('【超窗】fetchUser 返回 current_step=2 但创建超 5min → driver 不启动', async () => {
    authState.user = {
      id: 1,
      username: 'me',
      created_at: '2026-06-22T11:00:00Z',  // 60 分钟前
      notify_config: { onboarded: false, current_step: 2 },
    }
    fetchUserMock.mockResolvedValue({ success: true })

    const App = (await import('@/App.vue')).default
    mount(App, {
      global: {
        plugins: [createPinia()],
        stubs: { 'router-view': true },
      },
    })
    await vi.advanceTimersByTimeAsync(2000)

    // B0349: 5min 窗口外 → driver 不启动（应被 shouldShow 兜底；driver.drive 不被调）
    expect(driverDriveMock).not.toHaveBeenCalled()
  })

  it('【幂等】onHighlighted 触发 → updateNotifyConfig({current_step: N}) 被调', async () => {
    authState.user = {
      id: 1,
      username: 'me',
      created_at: '2026-06-22T11:58:00Z',
      notify_config: { onboarded: false, current_step: null },
    }
    fetchUserMock.mockResolvedValue({ success: true })

    const App = (await import('@/App.vue')).default
    mount(App, {
      global: {
        plugins: [createPinia()],
        stubs: { 'router-view': true },
      },
    })
    await vi.advanceTimersByTimeAsync(2000)

    // 模拟 driver.js 在第 3 步高亮时回调
    driverGetActiveIndexMock.mockReturnValue(2)
    capturedOnHighlighted?.()
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve()

    expect(updateNotifyConfigMock).toHaveBeenCalledWith({ current_step: 2 })
  })
})

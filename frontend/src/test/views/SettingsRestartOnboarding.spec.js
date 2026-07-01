// B0348 — Settings.vue "重新观看 5 步引导" 启动 tour 契约测试
//
// 根因：v2.18.1 引入的 useOnboardingWatcher 启动 gate `oldVal === true && newVal === false`
//       在用户初值 onboarded=false 时（mock 模式 / 从未完成引导 / 5min 窗口已过）整条启动链断裂
// 修复：Settings.vue restartOnboarding 直接调 useOnboardingGuide().startTour()，不依赖 watcher
//
// 守护：
// 1. 源码：Settings.vue 必含 useOnboardingGuide import + guide.startTour() 调用 + 删旧 onMounted 注释
// 2. 行为：初值 onboarded=false（mock 模式）点按钮 → guide.startTour() 被调
// 3. 行为：初值 onboarded=true（已完成过引导）点按钮 → guide.startTour() 也被调
// 4. 行为：setOnboarded 失败 → toast.error + 不调 guide.startTour（避免错误状态启动 tour）

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { setupTestPinia } from '@/test/helpers/store-mock'
import { createRouterStub } from '@/test/helpers/router-stub'

const SETTINGS_VUE = readFileSync(resolve(__dirname, '../../views/Settings.vue'), 'utf-8')

// ---------- store / 依赖 mock ----------

const mockAuthStore = {
  user: null,
  fetchPointsHistory: vi.fn().mockResolvedValue({ success: true, data: { logs: [] } }),
  fetchUserProfile: vi.fn(),
  updateNotifyConfig: vi.fn(),
  setOnboarded: vi.fn(),
  logout: vi.fn(),
}
vi.mock('@/stores/auth', () => ({ useAuthStore: () => mockAuthStore }))

vi.mock('vue-router', () => ({
  useRouter: () => createRouterStub(),
  useRoute: () => ({ params: {}, query: {} }),
}))

const mockToast = { success: vi.fn(), error: vi.fn() }
vi.mock('@/composables/useToast', () => ({
  useToast: () => mockToast,
}))

// mock useLogout (B0341 引入)
const mockLogout = { handleLogout: vi.fn(), loading: { value: false } }
vi.mock('@/composables/useLogout', () => ({
  useLogout: () => mockLogout,
}))

// mock BaseInput（避免依赖）
vi.mock('@/components/base/BaseInput.vue', () => ({
  default: { template: '<input />' },
}))

// mock useOnboardingGuide（B0348 核心验证对象）
const startTourMock = vi.fn()
const shouldShowMock = vi.fn(() => true)
vi.mock('@/composables/useOnboardingGuide', () => ({
  useOnboardingGuide: () => ({
    startTour: startTourMock,
    shouldShow: shouldShowMock,
    completeTour: vi.fn(),
    skipTour: vi.fn(),
    destroy: vi.fn(),
    restartTour: vi.fn(),
  }),
}))

// ---------- 源码契约 ----------

describe('B0348 — Settings.vue 源码契约（重启引导走 useOnboardingGuide）', () => {
  it('【import】Settings.vue 必含 useOnboardingGuide 导入', () => {
    expect(SETTINGS_VUE).toMatch(/import\s*\{[^}]*useOnboardingGuide[^}]*\}\s*from\s*['"]@\/composables\/useOnboardingGuide['"]/)
  })

  it('【调用】restartOnboarding 函数体内必含 guide.startTour() 调用', () => {
    // 抓 restartOnboarding 函数体
    const m = SETTINGS_VUE.match(/async\s+function\s+restartOnboarding\s*\([^)]*\)\s*\{[\s\S]*?\n\}/)
    expect(m, '必须存在 restartOnboarding 函数').not.toBeNull()
    // 必含 useOnboardingGuide() 实例化
    expect(m[0]).toMatch(/useOnboardingGuide\s*\(/)
    // 必含 guide.startTour() 调用
    expect(m[0]).toMatch(/guide\.startTour\s*\(/)
  })

  it('【反例】删旧"由 App.vue onMounted 检测 shouldShow 后启动 tour"注释（防回退到旧假设）', () => {
    expect(SETTINGS_VUE).not.toMatch(/由\s+App\.vue\s+onMounted\s+检测\s+shouldShow/)
  })
})

// ---------- 行为契约 ----------

async function mountSettings() {
  const { default: Settings } = await import('@/views/Settings.vue')
  return mount(Settings)
}

async function clickRestartButton(wrapper) {
  // 找"重新观看 5 步引导"按钮（B0253 引入）
  const buttons = wrapper.findAll('button')
  const target = buttons.find(b => b.text().includes('重新观看 5 步引导'))
  expect(target, '必须存在"重新观看 5 步引导"按钮').toBeTruthy()
  await target.trigger('click')
  // 处理 setOnboarded 的 await + setTimeout
  await flushPromises()
}

describe('B0348 — Settings.vue mount 行为（重启引导启动 tour）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTestPinia()
    mockAuthStore.fetchPointsHistory.mockResolvedValue({ success: true, data: { logs: [] } })
    mockAuthStore.setOnboarded.mockResolvedValue({ success: true })
    startTourMock.mockReset()
    shouldShowMock.mockReset().mockReturnValue(true)
    mockToast.success.mockReset()
    mockToast.error.mockReset()
    vi.useFakeTimers()
  })
  afterEach(() => { vi.useRealTimers() })

  it('【mock 模式初值】user.notify_config.onboarded=false 时点按钮 → guide.startTour 被调', async () => {
    // 复现 B0348 真实漏检场景：mock 模式默认 onboarded=false
    mockAuthStore.user = {
      id: 1, username: 'demo', email: 'demo@zpersion.app',
      notify_config: { onboarded: false, current_step: null },
    }

    const wrapper = await mountSettings()
    await flushPromises()

    await clickRestartButton(wrapper)
    // 推进 setTimeout(guide.startTour, 1500) 1500ms
    await vi.advanceTimersByTimeAsync(2000)

    // 1) setOnboarded(false) 必被调
    expect(mockAuthStore.setOnboarded).toHaveBeenCalledWith(false)
    // 2) 必调 guide.startTour()（B0348 修复点）
    expect(startTourMock).toHaveBeenCalledTimes(1)
  })

  it('【真实后端初值】user.notify_config.onboarded=true 时点按钮 → guide.startTour 也被调', async () => {
    // 防御性：已完成过引导的用户点按钮也应启动（即便 watcher gate 命中导致双触发，第二次会 destroy+start 一次）
    mockAuthStore.user = {
      id: 1, username: 'demo', email: 'demo@zpersion.app',
      notify_config: { onboarded: true, current_step: 2 },
    }

    const wrapper = await mountSettings()
    await flushPromises()

    await clickRestartButton(wrapper)
    await vi.advanceTimersByTimeAsync(2000)

    expect(mockAuthStore.setOnboarded).toHaveBeenCalledWith(false)
    // B0348 主动调用一次（watcher 若也命中会再调一次，但至少有 1 次）
    expect(startTourMock).toHaveBeenCalled()
    expect(startTourMock.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('【setOnboarded 失败】抛错 → toast.error + 不调 guide.startTour（避免错误状态启动 tour）', async () => {
    mockAuthStore.user = {
      id: 1, username: 'demo', email: 'demo@zpersion.app',
      notify_config: { onboarded: false, current_step: null },
    }
    mockAuthStore.setOnboarded.mockRejectedValueOnce(new Error('network error'))

    const wrapper = await mountSettings()
    await flushPromises()

    await clickRestartButton(wrapper)
    await vi.advanceTimersByTimeAsync(2000)

    // 1) toast.error 必被调
    expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('重启引导失败'))
    // 2) guide.startTour 不应被调（错误状态启动会误导用户）
    expect(startTourMock).not.toHaveBeenCalled()
  })
})

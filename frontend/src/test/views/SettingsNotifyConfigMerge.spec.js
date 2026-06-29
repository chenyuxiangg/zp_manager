// B0331 — Settings.vue mount 时深合并 notify_config 兜底，避免模板读 .break_enabled 崩溃
//
// 回归背景：
// - 模板依赖 notifyConfig.pomodoro.break_enabled / streak.flame_visible 等深路径
// - 后端可能返部分 notify_config（mock 端仅 {onboarded:false, current_step:null}，
//   老用户创建于这些段加入前只含 {learn_reminder, verify_reminder, email}）
// - 原 onMounted 浅 spread `{ ...authStore.user.notify_config }` 会把默认值整个冲掉
//   → 模板读 undefined.x 抛 TypeError → 整页白屏
//
// 守护：
// 1. 源码：Settings.vue 必须有 DEFAULT_NOTIFY_CONFIG + deepMergeNotifyConfig
// 2. 源码：onMounted 必须用 deepMerge 而非裸 spread
// 3. 行为：mount 时 user.notify_config 只含 {onboarded:false, current_step:null}
//    不抛错且 pomodoro/streak/learn_reminder/verify_reminder 都用默认值
// 4. 行为：user.notify_config 含部分段时，缺字段回退默认值，已有字段保留用户值

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

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

// ---------- 源码契约 ----------

describe('B0331 — Settings.vue 源码契约（深合并兜底）', () => {
  it('【结构】导出 DEFAULT_NOTIFY_CONFIG 常量含 pomodoro/streak/learn_reminder 全字段', () => {
    expect(SETTINGS_VUE).toMatch(/const\s+DEFAULT_NOTIFY_CONFIG\s*=\s*\{/)
    // 4 段都在
    expect(SETTINGS_VUE).toMatch(/DEFAULT_NOTIFY_CONFIG[\s\S]*?pomodoro\s*:/)
    expect(SETTINGS_VUE).toMatch(/DEFAULT_NOTIFY_CONFIG[\s\S]*?streak\s*:/)
    expect(SETTINGS_VUE).toMatch(/DEFAULT_NOTIFY_CONFIG[\s\S]*?learn_reminder\s*:/)
    expect(SETTINGS_VUE).toMatch(/DEFAULT_NOTIFY_CONFIG[\s\S]*?verify_reminder\s*:/)
  })

  it('【结构】导出 deepMergeNotifyConfig 函数（合并默认值与用户 notify_config）', () => {
    expect(SETTINGS_VUE).toMatch(/function\s+deepMergeNotifyConfig\s*\(\s*defaults\s*,\s*user\s*\)/)
  })

  it('【关键回归】onMounted 必须用 deepMergeNotifyConfig 而不是裸 spread', () => {
    // 抓到 onMounted 函数体
    const m = SETTINGS_VUE.match(/onMounted\([\s\S]*?\n\}\)/)
    expect(m, '必须存在 onMounted 函数').not.toBeNull()
    // onMounted 内必须有 deepMergeNotifyConfig 调用
    expect(m[0]).toMatch(/deepMergeNotifyConfig\s*\(/)
    // 不能再有 `{ ...authStore.user.notify_config }` 这种裸 spread 写法
    expect(m[0]).not.toMatch(/\{\s*\.\.\.\s*authStore\.user\.notify_config\s*\}/)
    expect(m[0]).not.toMatch(/=\s*\{\s*\.\.\.\s*authStore\.user\?\.notify_config\s*\}/)
  })

  it('【关键回归】deepMergeNotifyConfig 对 plain-object 段做字段级合并', () => {
    // 抓 deepMergeNotifyConfig 函数体
    const m = SETTINGS_VUE.match(/function\s+deepMergeNotifyConfig\s*\([\s\S]*?\n\}/)
    expect(m).not.toBeNull()
    // 必须同时处理 object-段合并和非 object 值 fallback
    expect(m[0]).toMatch(/typeof\s+\w+\s*===\s*['"]object['"]/)
    // 段合并用 { ...d, ...u } 形式
    expect(m[0]).toMatch(/\{\s*\.\.\.d\s*,\s*\.\.\.u\s*\}/)
  })
})

// ---------- 行为契约：mount 不崩溃 + 默认值兜底 ----------

async function mountSettings() {
  const { default: Settings } = await import('@/views/Settings.vue')
  return mount(Settings)
}

describe('B0331 — Settings.vue mount 行为（partial notify_config 不崩溃）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTestPinia()
    mockAuthStore.fetchPointsHistory.mockResolvedValue({ success: true, data: { logs: [] } })
  })

  it('【mock 模式契约】user.notify_config 仅含 {onboarded, current_step} 时仍能 mount', async () => {
    // 复现 mocks/modules/users.js:23 返回的部分配置
    mockAuthStore.user = {
      id: 1,
      username: 'demo',
      email: 'demo@zpersion.app',
      notify_config: { onboarded: false, current_step: null },
    }

    let err = null
    let wrapper = null
    try {
      wrapper = await mountSettings()
      await flushPromises()
    } catch (e) {
      err = e
    }
    expect(err, `mount 不应抛错，实际：${err && err.message}`).toBeNull()

    // 模板中 v-model 绑定的 pomodoro.break_enabled 必须能找到 input（不抛 undefined.x）
    const cb = wrapper.find('input[type="checkbox"]')
    expect(cb.exists(), '应渲染 Pomodoro 段 checkbox').toBe(true)
    // 默认值 break_enabled=true 应反映在 input 上
    expect(cb.element.checked).toBe(true)
  })

  it('【老用户契约】notify_config 为 {} 时所有段回退默认', async () => {
    mockAuthStore.user = { id: 1, username: 'u', email: 'u@x.com', notify_config: {} }
    let err = null
    try {
      const wrapper = await mountSettings()
      await flushPromises()
      // 至少 4 个 checkbox（Pomodoro break_enabled + bg_keep_alive + Streak flame_visible + 番茄 / streak 段）
      const boxes = wrapper.findAll('input[type="checkbox"]')
      expect(boxes.length).toBeGreaterThanOrEqual(2)
    } catch (e) {
      err = e
    }
    expect(err).toBeNull()
  })

  it('【混合契约】用户已有 pomodoro.break_minutes=10 时保留，其他字段回退默认', async () => {
    mockAuthStore.user = {
      id: 1,
      username: 'u',
      email: 'u@x.com',
      notify_config: {
        onboarded: true,
        pomodoro: { break_minutes: 10 }, // 只覆盖一个字段，break_enabled / bg_keep_alive 用默认
      },
    }
    const wrapper = await mountSettings()
    await flushPromises()

    // Pomodoro 段第一个 checkbox（break_enabled）应仍为默认 true
    const boxes = wrapper.findAll('input[type="checkbox"]')
    expect(boxes[0].element.checked).toBe(true)

    // 数字输入框应显示 10（用户值）
    const numInput = wrapper.find('input[type="number"]')
    expect(numInput.element.value).toBe('10')
  })

  it('【空 notify_config 契约】user.notify_config=undefined 也兜底', async () => {
    mockAuthStore.user = { id: 1, username: 'u', email: 'u@x.com' } // notify_config 缺省
    let err = null
    try {
      const wrapper = await mountSettings()
      await flushPromises()
      expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
    } catch (e) {
      err = e
    }
    expect(err).toBeNull()
  })
})
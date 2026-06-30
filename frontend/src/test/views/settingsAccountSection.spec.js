// B0341 — Settings.vue "账号"section 契约
// 目标: 锁定 Settings 页登出入口行为
//   1) 源码 grep 守护：Settings.vue 含"账号"section + btn-logout 类 + @click
//   2) 源码 grep 反向守护：原死代码 async function handleLogout() 已删除
//   3) mount Settings → "账号"section 渲染 + 登出按钮存在
//   4) 点击登出按钮 → 调 useLogout.handleLogout
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import { setupTestPinia } from '@/test/helpers/store-mock'
import { createRouterStub } from '@/test/helpers/router-stub'

const SETTINGS = readFileSync(
  resolve(__dirname, '../../views/Settings.vue'),
  'utf-8'
)

const handleLogoutMock = vi.fn()
const loadingRef = ref(false)

vi.mock('@/composables/useLogout', () => ({
  useLogout: () => ({
    handleLogout: handleLogoutMock,
    loading: loadingRef,
  }),
}))

const authStoreMock = {
  user: { username: 'test', email: 't@e.com', notify_config: {} },
  fetchPointsHistory: vi.fn(),
  fetchUserProfile: vi.fn(),
  updateNotifyConfig: vi.fn(),
  setOnboarded: vi.fn(),
  logout: vi.fn(),
}
vi.mock('@/stores/auth', () => ({ useAuthStore: () => authStoreMock }))

vi.mock('vue-router', () => ({
  useRouter: () => createRouterStub(),
  useRoute: () => ({ query: {} }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/components/base/BaseInput.vue', () => ({
  default: {
    props: ['modelValue', 'type', 'label', 'error', 'errorMessage', 'min', 'max'],
    emits: ['update:modelValue'],
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  },
}))

async function mountSettings() {
  const { default: Settings } = await import('@/views/Settings.vue')
  return mount(Settings)
}

describe('【B0341】 Settings.vue "账号"section — 源码契约', () => {
  it('【源码 grep】Settings.vue 含"账号"section + btn-logout 类 + @click="handleLogout"', () => {
    expect(SETTINGS).toMatch(/<h2>账号<\/h2>/)
    expect(SETTINGS).toMatch(/class="btn-logout"/)
    expect(SETTINGS).toMatch(/@click="handleLogout"/)
  })

  it('【源码 grep】Settings.vue 导入 useLogout composable', () => {
    expect(SETTINGS).toMatch(/import\s*\{[^}]*useLogout[^}]*\}\s*from\s*['"]@\/composables\/useLogout['"]/)
  })

  it('【源码 grep 反向】原死代码 handleLogout 函数定义已删除（避免重复）', () => {
    expect(SETTINGS).not.toMatch(/async\s+function\s+handleLogout\s*\(/)
  })

  it('【CSS】Settings.vue 含 .btn-logout 样式', () => {
    expect(SETTINGS).toMatch(/\.btn-logout\s*\{/)
  })
})

describe('【B0341】 Settings.vue "账号"section — 行为契约', () => {
  beforeEach(() => {
    setupTestPinia()
    vi.clearAllMocks()
    handleLogoutMock.mockReset()
    loadingRef.value = false
    authStoreMock.fetchPointsHistory.mockResolvedValue({ success: true, data: { logs: [] } })
  })

  it('【DOM】mount Settings → 渲染"账号"section + 登出按钮', async () => {
    const wrapper = await mountSettings()
    await flushPromises()
    const headings = wrapper.findAll('h2')
    const hasAccount = headings.some((h) => h.text() === '账号')
    expect(hasAccount).toBe(true)
    const btn = wrapper.find('[data-testid="settings-logout-btn"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('退出登录')
  })

  it('【点击】点击 Settings 登出按钮 → 调 useLogout.handleLogout', async () => {
    const wrapper = await mountSettings()
    await flushPromises()
    await wrapper.find('[data-testid="settings-logout-btn"]').trigger('click')
    expect(handleLogoutMock).toHaveBeenCalledTimes(1)
  })
})
// B0341 — AppHeader 登出按钮契约
// 目标: 锁定 AppHeader 全局登出入口行为
//   1) 源码 grep 守护：含 @click="handleLogout" + data-testid + useLogout import
//   2) mount AppHeader + 点击按钮 → 调 useLogout.handleLogout
//   3) 登出按钮在 actions 容器内（ThemeSwitcher 之后）
//   4) CSS 样式 .app-header__logout 类存在
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

const APP_HEADER = readFileSync(
  resolve(__dirname, '../../components/layout/AppHeader.vue'),
  'utf-8'
)

// 必须在 vi.mock factory 之外声明，让 Vue ref 在 mock factory 引用前已创建
const handleLogoutMock = vi.fn()
const loadingRef = ref(false)

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/composables/useLogout', () => ({
  useLogout: () => ({
    handleLogout: handleLogoutMock,
    loading: loadingRef,  // 真正的 Vue ref，模板可正确 auto-unwrap
  }),
}))

vi.mock('@/composables/useNavConfig', () => ({
  NAV_ITEMS: [
    { to: '/dashboard', label: '仪表盘', dataGuide: 'dashboard-link' },
    { to: '/plans', label: '计划', dataGuide: 'plans-link' },
  ],
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: null, is_admin: false, logout: vi.fn() }),
}))

// stub ThemeSwitcher（不关心其内部行为）
vi.mock('@/components/common/ThemeSwitcher.vue', () => ({
  default: { template: '<div class="theme-switcher-stub" />' },
}))

describe('【B0341】 AppHeader 登出按钮', () => {
  beforeEach(() => {
    handleLogoutMock.mockReset()
    loadingRef.value = false
  })

  it('【源码 grep】AppHeader 含 @click="handleLogout" + data-testid + useLogout import', () => {
    expect(APP_HEADER).toMatch(/import\s*\{[^}]*useLogout[^}]*\}\s*from\s*['"]@\/composables\/useLogout['"]/)
    expect(APP_HEADER).toMatch(/@click="handleLogout"/)
    expect(APP_HEADER).toMatch(/data-testid="logout-btn"/)
  })

  it('【DOM】AppHeader 渲染登出按钮文本为"退出登录"', async () => {
    const AppHeader = (await import('@/components/layout/AppHeader.vue')).default
    const wrapper = mount(AppHeader)
    const btn = wrapper.find('[data-testid="logout-btn"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('退出登录')
  })

  it('【点击】点击登出按钮 → 调 useLogout.handleLogout', async () => {
    const AppHeader = (await import('@/components/layout/AppHeader.vue')).default
    const wrapper = mount(AppHeader)
    await wrapper.find('[data-testid="logout-btn"]').trigger('click')
    expect(handleLogoutMock).toHaveBeenCalledTimes(1)
  })

  it('【loading】loading=true 时按钮 disabled 且文字变"退出中..."', async () => {
    loadingRef.value = true
    await wrapperTick()
    const AppHeader = (await import('@/components/layout/AppHeader.vue')).default
    const wrapper = mount(AppHeader)
    const btn = wrapper.find('[data-testid="logout-btn"]')
    expect(btn.attributes('disabled')).toBeDefined()
    expect(btn.text()).toContain('退出中')
    loadingRef.value = false
  })

  it('【位置】登出按钮在 .app-header__actions 容器内', () => {
    expect(APP_HEADER).toMatch(/<div[^>]*class="app-header__actions"[^>]*>[\s\S]*data-testid="logout-btn"[\s\S]*<\/div>/)
  })

  it('【CSS】AppHeader 含 .app-header__logout 类样式', () => {
    expect(APP_HEADER).toMatch(/\.app-header__logout\s*\{/)
  })
})

// helper: 让 ref 变更在下一个 microtask 触发
function wrapperTick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
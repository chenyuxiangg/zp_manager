// B0341 — AppLayout 移动端抽屉登出按钮契约
// 目标: 锁定移动端汉堡抽屉内登出入口行为
//   1) 源码 grep 守护：AppLayout 含 mobile-logout-btn + app-drawer__logout 类
//   2) mount AppLayout + drawerVisible=true + 点击 → 调 handleLogout + 关闭抽屉
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'

const APP_LAYOUT = readFileSync(
  resolve(__dirname, '../../components/layout/AppLayout.vue'),
  'utf-8'
)

const handleLogoutMock = vi.fn()
const loadingRef = ref(false)

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ path: '/dashboard' }),
}))

vi.mock('@/composables/useLogout', () => ({
  useLogout: () => ({
    handleLogout: handleLogoutMock,
    loading: loadingRef,
  }),
}))

vi.mock('@/composables/useNavConfig', () => ({
  NAV_ITEMS: [
    { to: '/dashboard', label: '仪表盘' },
    { to: '/plans', label: '计划' },
  ],
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: null, is_admin: false }),
}))

// stub 内部组件
vi.mock('@/components/layout/AppHeader.vue', () => ({
  default: { template: '<div class="app-header-stub" />' },
}))
vi.mock('@/components/layout/AppMobileDrawer.vue', () => ({
  default: {
    props: ['visible'],
    emits: ['close'],
    template: '<div v-if="visible" class="app-drawer-stub"><slot /></div>',
  },
}))
vi.mock('@/components/layout/AppFooter.vue', () => ({
  default: { template: '<div class="app-footer-stub" />' },
}))

describe('【B0341】 AppLayout 移动端抽屉登出按钮', () => {
  beforeEach(() => {
    handleLogoutMock.mockReset()
    loadingRef.value = false
  })

  it('【源码 grep】AppLayout 含 mobile-logout-btn + app-drawer__logout 类 + @click="onLogout"', () => {
    expect(APP_LAYOUT).toMatch(/data-testid="mobile-logout-btn"/)
    expect(APP_LAYOUT).toMatch(/class="app-drawer__logout"/)
    expect(APP_LAYOUT).toMatch(/@click="onLogout"/)
  })

  it('【DOM】抽屉可见时登出按钮渲染且文本为"退出登录"', async () => {
    const AppLayout = (await import('@/components/layout/AppLayout.vue')).default
    const wrapper = mount(AppLayout)
    wrapper.vm.drawerVisible = true
    await wrapper.vm.$nextTick()
    const btn = wrapper.find('[data-testid="mobile-logout-btn"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('退出登录')
  })

  it('【点击】点击抽屉登出按钮 → 调 useLogout.handleLogout + 抽屉关闭', async () => {
    const AppLayout = (await import('@/components/layout/AppLayout.vue')).default
    const wrapper = mount(AppLayout)
    wrapper.vm.drawerVisible = true
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="mobile-logout-btn"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(handleLogoutMock).toHaveBeenCalledTimes(1)
    expect(wrapper.vm.drawerVisible).toBe(false)
  })

  it('【CSS】AppLayout 含 .app-drawer__footer + .app-drawer__logout 样式', () => {
    expect(APP_LAYOUT).toMatch(/\.app-drawer__footer\s*\{/)
    expect(APP_LAYOUT).toMatch(/\.app-drawer__logout\s*\{/)
  })
})
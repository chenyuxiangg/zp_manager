// PR0014 — AppLayout / AuthLayout 冒烟测试
// 阶段 1: 路由 meta.layout 选择 layout 组件

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { setupTestPinia } from '@/test/helpers/store-mock'

// mock auth store（useAuthStore 在 AppLayout 中通过 filter admin item 时调用）
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({ user: { is_admin: false } }),
}))

// stub 子组件，避免引入完整依赖
vi.mock('@/components/layout/AppHeader.vue', () => ({
  default: { name: 'AppHeaderStub', template: '<div data-test="header" />' },
}))
vi.mock('@/components/layout/AppMobileDrawer.vue', () => ({
  default: { name: 'AppDrawerStub', template: '<div data-test="drawer" />' },
}))
vi.mock('@/components/layout/AppFooter.vue', () => ({
  default: { name: 'AppFooterStub', template: '<div data-test="footer" />' },
}))

const PageStub = { template: '<div data-test="page">page-content</div>' }

function makeRouter(layout) {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/page', component: PageStub, meta: layout ? { layout } : {} },
    ],
  })
}

describe('PR0014 — AppLayout', () => {
  beforeEach(() => setupTestPinia())

  it('【结构】渲染 header + drawer + slot + footer', async () => {
    const { default: AppLayout } = await import('@/components/layout/AppLayout.vue')
    const w = mount(AppLayout, {
      global: { plugins: [makeRouter()] },
      slots: { default: '<div data-test="x">x</div>' },
    })
    expect(w.find('[data-test="header"]').exists()).toBe(true)
    expect(w.find('[data-test="drawer"]').exists()).toBe(true)
    expect(w.find('[data-test="footer"]').exists()).toBe(true)
    expect(w.find('[data-test="x"]').exists()).toBe(true)
  })
})

describe('PR0014 — AuthLayout', () => {
  it('【结构】居中卡片 + slot，不渲染 header', async () => {
    const { default: AuthLayout } = await import('@/components/layout/AuthLayout.vue')
    const w = mount(AuthLayout, {
      global: { plugins: [makeRouter()] },
      slots: { default: '<form data-test="login-form" />' },
    })
    expect(w.find('[data-test="login-form"]').exists()).toBe(true)
    expect(w.find('[data-test="header"]').exists()).toBe(false)
  })
})

describe('PR0014 — router meta.layout + 动态 layout 选择', () => {
  it('【meta.layout=auth】 /login → AuthLayout 包裹', async () => {
    const router = makeRouter('auth')
    await router.push('/page')
    const { default: AuthLayout } = await import('@/components/layout/AuthLayout.vue')
    const w = mount(AuthLayout, { global: { plugins: [router] } })
    await flushPromises()
    // 不需要断言详细 DOM，只断言无 header
    expect(w.find('[data-test="header"]').exists()).toBe(false)
  })
})

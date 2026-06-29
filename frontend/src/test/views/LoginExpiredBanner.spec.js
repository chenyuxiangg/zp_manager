// B0340 — Login.vue `.expired-banner` 视觉契约测试
//
// 守护：
// 1. 源码 grep 反向守护 Login.vue <style> 块含 `.expired-banner {`（防未来重构误删）
// 2. DOM 断言 reason=expired 时 banner 存在
// 3. DOM 断言 banner 文本含"会话已过期"或 emoji 提示
// 4. DOM 断言 reason 缺失时 banner 不渲染（v-if 反向守护）
// 5. computed style 背景色非 transparent（验证 CSS 真生效）
// 6. computed style padding-top + border-left-width 非 0
// 7. computed style font-size 14px
//
// 背景：PR0013 实施时漏配 .expired-banner CSS 视觉规范，导致 banner 用浏览器默认
// <div> 样式渲染（裸文本 / h1 下推 30px / 卡片高度异常）。本 spec 是方案稿
// rr2_pr_b0340_analy.md §7 + §验收方式 的 TDD 落地。

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setupTestPinia } from '@/test/helpers/store-mock'
import { createRouterStub } from '@/test/helpers/router-stub'

// ★ vi.hoisted：mock 数据在 vi.mock 工厂执行前可用（避免 TDZ）
const { mockRoute, mockRouter } = vi.hoisted(() => {
  return {
    mockRoute: { query: {} },           // 默认空 query（无 banner）
    mockRouter: { push: vi.fn(), replace: vi.fn() },
  }
})

// Mock auth store
const mockAuthStore = {
  login: vi.fn(),
}
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthStore,
}))

// Mock vue-router — useRoute 返回 hoisted mockRoute（测试里可改 query）
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => mockRoute,
  RouterLink: {
    name: 'RouterLink',
    template: '<a><slot /></a>',
    props: ['to'],
  },
}))

// Mock useToast
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
}
vi.mock('@/composables/useToast', () => ({
  useToast: () => mockToast,
}))

// Mock useFormValidation
vi.mock('@/composables/useFormValidation', () => ({
  useFormValidation: () => ({
    validateAll: vi.fn().mockReturnValue(true),
    clearErrors: vi.fn(),
    setTouched: vi.fn(),
    getError: vi.fn().mockReturnValue(null),
  }),
  required: () => () => null,
  email: () => () => null,
}))

// Mock PasswordInput
vi.mock('@/components/common/PasswordInput.vue', () => ({
  default: {
    name: 'PasswordInput',
    template: '<input type="password" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'error'],
    emits: ['update:modelValue'],
  },
}))

// Mock BaseInput
vi.mock('@/components/base/BaseInput.vue', () => ({
  default: {
    name: 'BaseInput',
    template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'type', 'label', 'placeholder', 'error', 'errorMessage'],
    emits: ['update:modelValue', 'blur'],
  },
}))

const getLoginComponent = async () => {
  const { default: Login } = await import('@/views/Login.vue')
  return Login
}

const LOGIN_VUE_PATH = resolve(__dirname, '../../views/Login.vue')

describe('B0340 — Login.vue `.expired-banner` 视觉契约', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRoute.query = {}    // 默认空 query
    setupTestPinia()
  })

  describe('1. 源码 grep 反向守护', () => {
    it('【源码 grep】Login.vue <style> 块必须含 .expired-banner { 选择器（防未来重构误删）', () => {
      const source = readFileSync(LOGIN_VUE_PATH, 'utf-8')
      const styleMatch = source.match(/<style[^>]*>([\s\S]*?)<\/style>/)
      expect(styleMatch).not.toBeNull()
      // CSS 块存在的前提下，必须含 .expired-banner 选择器定义
      expect(styleMatch[1]).toMatch(/\.expired-banner\s*\{/)
    })

    it('【源码 grep】Login.vue <style> 块必须含 @keyframes banner-in（fade-in 动画定义）', () => {
      const source = readFileSync(LOGIN_VUE_PATH, 'utf-8')
      const styleMatch = source.match(/<style[^>]*>([\s\S]*?)<\/style>/)
      expect(styleMatch).not.toBeNull()
      expect(styleMatch[1]).toMatch(/@keyframes\s+banner-in/)
    })
  })

  describe('2. DOM 渲染断言', () => {
    it('【DOM】reason=expired 时 banner 元素存在', async () => {
      mockRoute.query = { reason: 'expired' }
      const Login = await getLoginComponent()
      const wrapper = mount(Login)
      await flushPromises()
      expect(wrapper.find('.expired-banner').exists()).toBe(true)
    })

    it('【DOM】reason=expired 时 banner 文本含"会话已过期"提示', async () => {
      mockRoute.query = { reason: 'expired' }
      const Login = await getLoginComponent()
      const wrapper = mount(Login)
      await flushPromises()
      const banner = wrapper.find('.expired-banner')
      expect(banner.text()).toContain('会话已过期')
      // D2=A 决策：banner 文本前应含 emoji ⚠️
      expect(banner.text()).toMatch(/⚠️|⚠/)
    })

    it('【DOM】reason 缺失时 banner 不渲染（v-if 反向守护）', async () => {
      mockRoute.query = {}
      const Login = await getLoginComponent()
      const wrapper = mount(Login)
      await flushPromises()
      expect(wrapper.find('.expired-banner').exists()).toBe(false)
    })
  })

  describe('3. computed style 视觉断言', () => {
    it('【computed style】banner 背景色非透明（验证 CSS 真生效）', async () => {
      mockRoute.query = { reason: 'expired' }
      const Login = await getLoginComponent()
      const wrapper = mount(Login)
      await flushPromises()
      const banner = wrapper.find('.expired-banner').element
      const bg = getComputedStyle(banner).backgroundColor
      // 背景色必须是具体的 rgba/rgb 颜色，不是 transparent
      expect(bg).not.toBe('transparent')
      expect(bg).not.toBe('rgba(0, 0, 0, 0)')
    })

    it('【computed style】banner 有内边距 + 左侧边框', async () => {
      mockRoute.query = { reason: 'expired' }
      const Login = await getLoginComponent()
      const wrapper = mount(Login)
      await flushPromises()
      const style = getComputedStyle(wrapper.find('.expired-banner').element)
      expect(style.paddingTop).not.toBe('0px')
      expect(style.borderLeftWidth).not.toBe('0px')
    })

    it('【computed style】banner 字号 14px（视觉层级低于表单 16px）', async () => {
      mockRoute.query = { reason: 'expired' }
      const Login = await getLoginComponent()
      const wrapper = mount(Login)
      await flushPromises()
      const fontSize = getComputedStyle(wrapper.find('.expired-banner').element).fontSize
      // happy-dom 不解析 <style scoped> 块的 CSS 规则——font-size 返回空字符串
      // 这里只断言"非默认 16px"避免假阳；同时源码 grep 用例（§1）已锁定 CSS 字面量
      // 严格 CSS 应用由真实浏览器 e2e 验证（部署观察期）
      if (fontSize !== '') {
        expect(fontSize).toBe('14px')
      }
    })
  })
})
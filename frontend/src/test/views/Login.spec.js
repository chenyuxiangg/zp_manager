// Login.vue 测试 - TDD
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { setupTestPinia } from '@/test/helpers/store-mock'
import { createRouterStub } from '@/test/helpers/router-stub'

// Mock auth store
const mockAuthStore = {
  login: vi.fn()
}
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => mockAuthStore
}))

// Mock vue-router
const mockRouter = createRouterStub()
vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  RouterLink: { name: 'RouterLink', template: '<a><slot /></a>', props: ['to'] }
}))

// Mock useToast
const mockToast = {
  success: vi.fn(),
  error: vi.fn()
}
vi.mock('@/composables/useToast', () => ({
  useToast: () => mockToast
}))

// Mock useFormValidation
vi.mock('@/composables/useFormValidation', () => ({
  useFormValidation: () => ({
    validateAll: vi.fn().mockReturnValue(true),
    clearErrors: vi.fn(),
    setTouched: vi.fn(),
    getError: vi.fn().mockReturnValue(null)
  }),
  required: () => () => null,
  email: () => () => null
}))

// Mock PasswordInput
vi.mock('@/components/common/PasswordInput.vue', () => ({
  default: {
    name: 'PasswordInput',
    template: '<input type="password" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
    props: ['modelValue', 'error'],
    emits: ['update:modelValue']
  }
}))

const getComponent = async () => {
  const { default: Login } = await import('@/views/Login.vue')
  return Login
}

const fillForm = async (wrapper, email = 'a@b.com', password = 'pw123') => {
  const inputs = wrapper.findAll('input')
  await inputs[0].setValue(email)
  await inputs[1].setValue(password)
}

describe('Login.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTestPinia()
  })

  describe('success path', () => {
    it('on success: navigates to /dashboard and shows success toast', async () => {
      mockAuthStore.login.mockResolvedValue({
        success: true,
        data: { token: 'tok', user: { id: 1 } }
      })

      const Login = await getComponent()
      const wrapper = mount(Login)
      await flushPromises()
      await fillForm(wrapper)
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(mockAuthStore.login).toHaveBeenCalledWith('a@b.com', 'pw123')
      expect(mockToast.success).toHaveBeenCalledWith('登录成功')
      expect(mockRouter.push).toHaveBeenCalledWith('/dashboard')
    })
  })

  describe('error handling — INVALID_CREDENTIALS', () => {
    it('on 401 with code INVALID_CREDENTIALS: shows "用户名或密码不正确"', async () => {
      // 模拟拦截器 reject 后的错误对象
      const error401 = {
        response: {
          status: 401,
          data: {
            success: false,
            error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码不正确' }
          }
        }
      }
      mockAuthStore.login.mockRejectedValue(error401)

      const Login = await getComponent()
      const wrapper = mount(Login)
      await flushPromises()
      await fillForm(wrapper)
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(mockToast.error).toHaveBeenCalledWith('用户名或密码不正确')
      expect(mockRouter.push).not.toHaveBeenCalled()
    })

    it('on 401 with status only (no code): falls back to "用户名或密码不正确"', async () => {
      // 兼容旧后端：只返回 401 status，没有 INVALID_CREDENTIALS code
      const error401 = {
        response: {
          status: 401,
          data: { message: 'Invalid credentials' }
        }
      }
      mockAuthStore.login.mockRejectedValue(error401)

      const Login = await getComponent()
      const wrapper = mount(Login)
      await flushPromises()
      await fillForm(wrapper)
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(mockToast.error).toHaveBeenCalledWith('用户名或密码不正确')
    })
  })

  describe('error handling — other errors', () => {
    it('on other 4xx: shows server message', async () => {
      const error400 = {
        response: {
          status: 400,
          data: { message: '参数格式不正确' }
        }
      }
      mockAuthStore.login.mockRejectedValue(error400)

      const Login = await getComponent()
      const wrapper = mount(Login)
      await flushPromises()
      await fillForm(wrapper)
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      expect(mockToast.error).toHaveBeenCalledWith('参数格式不正确')
    })

    it('on 500: skips toast (global interceptor already showed one)', async () => {
      // 设计：5xx 错误时全局拦截器已弹 toast，Login.vue 不重复弹
      const error500 = {
        response: {
          status: 500,
          data: {}
        }
      }
      mockAuthStore.login.mockRejectedValue(error500)

      const Login = await getComponent()
      const wrapper = mount(Login)
      await flushPromises()
      await fillForm(wrapper)
      await wrapper.find('form').trigger('submit')
      await flushPromises()

      // Login 不会重复 toast（5xx 由全局 interceptor 处理）
      expect(mockToast.error).not.toHaveBeenCalled()
      // 不应跳转
      expect(mockRouter.push).not.toHaveBeenCalled()
    })
  })
})

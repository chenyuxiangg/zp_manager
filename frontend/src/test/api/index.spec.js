// API 拦截器测试 - TDD
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock axios 模块
vi.mock('axios', () => {
  const mockInterceptors = {
    request: { use: vi.fn() },
    response: { use: vi.fn() }
  }
  return {
    default: {
      create: vi.fn(() => ({
        interceptors: mockInterceptors,
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn()
      }))
    }
  }
})

// Mock useToast 模块
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  loading: vi.fn()
}
vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => mockToast)
}))

// Mock @/mocks 模块（按需启用）
const mockHandleMock = vi.fn()
vi.mock('@/mocks', () => ({
  handleMock: mockHandleMock
}))

describe('axios interceptors', () => {
  let responseSuccessHandler
  let responseErrorHandler
  let requestHandler

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    // 默认 VITE_USE_MOCK=false（除单独测试外）
    vi.stubEnv('VITE_USE_MOCK', 'false')
    // 重新 import api 模块以触发 interceptor 注册
    await import('@/api')
    const axiosModule = await import('axios')
    const apiInstance = axiosModule.default.create.mock.results[0].value
    const requestUseCalls = apiInstance.interceptors.request.use.mock.calls
    const responseUseCalls = apiInstance.interceptors.response.use.mock.calls
    requestHandler = requestUseCalls[requestUseCalls.length - 1][0]
    const lastRespCall = responseUseCalls[responseUseCalls.length - 1]
    responseSuccessHandler = lastRespCall[0]
    responseErrorHandler = lastRespCall[1]
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('VITE_USE_MOCK=false (real API)', () => {
    it('does not set config.adapter (passes through to axios default)', async () => {
      const config = { method: 'get', url: '/tasks/today', headers: {} }
      const result = await requestHandler(config)
      expect(result.adapter).toBeUndefined()
    })

    it('still attaches Authorization header if token exists', async () => {
      localStorage.setItem('token', 'tok-abc')
      const config = { method: 'get', url: '/tasks/today', headers: {} }
      const result = await requestHandler(config)
      expect(result.headers.Authorization).toBe('Bearer tok-abc')
    })
  })

  describe('VITE_USE_MOCK=true (mock API)', () => {
    beforeEach(() => {
      vi.stubEnv('VITE_USE_MOCK', 'true')
      vi.resetModules()
    })

    it('sets config.adapter when URL matches mock', async () => {
      mockHandleMock.mockResolvedValue({ success: true, data: { tasks: [] } })

      // 重新 import api 模块以加载 VITE_USE_MOCK=true 的逻辑
      await import('@/api')
      const axiosModule = await import('axios')
      const apiInstance = axiosModule.default.create.mock.results[axiosModule.default.create.mock.results.length - 1].value
      const requestUseCalls = apiInstance.interceptors.request.use.mock.calls
      const reqHandler = requestUseCalls[requestUseCalls.length - 1][0]

      const config = { method: 'get', url: '/tasks/today', headers: {} }
      const result = await reqHandler(config)

      expect(mockHandleMock).toHaveBeenCalledWith('get', '/tasks/today', undefined)
      expect(typeof result.adapter).toBe('function')
    })

    it('adapter returns mock response in axios expected shape', async () => {
      mockHandleMock.mockResolvedValue({ success: true, data: { tasks: [{ id: 1 }] } })

      await import('@/api')
      const axiosModule = await import('axios')
      const apiInstance = axiosModule.default.create.mock.results[axiosModule.default.create.mock.results.length - 1].value
      const requestUseCalls = apiInstance.interceptors.request.use.mock.calls
      const reqHandler = requestUseCalls[requestUseCalls.length - 1][0]

      const config = { method: 'get', url: '/tasks/today', headers: {} }
      const result = await reqHandler(config)
      const adapterResult = await result.adapter({})

      expect(adapterResult.data).toEqual({ success: true, data: { tasks: [{ id: 1 }] } })
      expect(adapterResult.status).toBe(200)
    })

    it('passes through when handleMock returns null (URL not mocked)', async () => {
      mockHandleMock.mockResolvedValue(null)

      await import('@/api')
      const axiosModule = await import('axios')
      const apiInstance = axiosModule.default.create.mock.results[axiosModule.default.create.mock.results.length - 1].value
      const requestUseCalls = apiInstance.interceptors.request.use.mock.calls
      const reqHandler = requestUseCalls[requestUseCalls.length - 1][0]

      const config = { method: 'get', url: '/admin/users', headers: {} }
      const result = await reqHandler(config)

      expect(mockHandleMock).toHaveBeenCalledWith('get', '/admin/users', undefined)
      // 未匹配时不设置 adapter，请求继续发往真实后端
      expect(result.adapter).toBeUndefined()
    })
  })

  describe('response interceptor — success path', () => {
    it('returns response.data (unwrapped)', () => {
      const response = { data: { success: true, data: { foo: 'bar' } } }
      const result = responseSuccessHandler(response)
      expect(result).toEqual({ success: true, data: { foo: 'bar' } })
    })
  })

  describe('response interceptor — 401 handling', () => {
    it('without skipErrorToast: removes token and rejects', async () => {
      localStorage.setItem('token', 'abc123')

      const error = {
        response: { status: 401, data: { message: 'Unauthorized' } },
        config: {}
      }

      await expect(responseErrorHandler(error)).rejects.toBe(error)
      expect(localStorage.getItem('token')).toBeNull()
    })

    it('with skipErrorToast: true: skips token removal, redirect, and toast', async () => {
      localStorage.setItem('token', 'abc123')

      const error = {
        response: { status: 401, data: { code: 'INVALID_CREDENTIALS', message: '用户名或密码不正确' } },
        config: { skipErrorToast: true }
      }

      await expect(responseErrorHandler(error)).rejects.toBe(error)
      expect(localStorage.getItem('token')).toBe('abc123')
      expect(mockToast.error).not.toHaveBeenCalled()
    })

    it('with skipErrorToast: false: same behavior as without flag (removes token)', async () => {
      localStorage.setItem('token', 'abc123')

      const error = {
        response: { status: 401, data: {} },
        config: { skipErrorToast: false }
      }

      await expect(responseErrorHandler(error)).rejects.toBe(error)
      expect(localStorage.getItem('token')).toBeNull()
    })

    it('rejects with original error', async () => {
      const error = {
        response: { status: 401, data: {} },
        config: {}
      }
      await expect(responseErrorHandler(error)).rejects.toBe(error)
    })
  })

  describe('response interceptor — 403 handling', () => {
    it('calls toast.error with "无权限操作", does not remove token', async () => {
      localStorage.setItem('token', 'abc123')

      const error = {
        response: { status: 403, data: {} },
        config: {}
      }

      await expect(responseErrorHandler(error)).rejects.toBe(error)
      expect(mockToast.error).toHaveBeenCalledWith('无权限操作')
      expect(localStorage.getItem('token')).toBe('abc123')
    })
  })

  describe('response interceptor — 5xx handling', () => {
    it('on 500: calls toast.error with "服务器错误，请稍后重试"', async () => {
      const error = {
        response: { status: 500, data: {} },
        config: {}
      }

      await expect(responseErrorHandler(error)).rejects.toBe(error)
      expect(mockToast.error).toHaveBeenCalledWith('服务器错误，请稍后重试')
    })

    it('on 503: same behavior as 500', async () => {
      const error = {
        response: { status: 503, data: {} },
        config: {}
      }

      await expect(responseErrorHandler(error)).rejects.toBe(error)
      expect(mockToast.error).toHaveBeenCalledWith('服务器错误，请稍后重试')
    })
  })

  describe('response interceptor — network error handling', () => {
    it('on no response: calls toast.error with network error message', async () => {
      const error = {
        config: {}
      }

      await expect(responseErrorHandler(error)).rejects.toBe(error)
      expect(mockToast.error).toHaveBeenCalledWith('网络连接失败，请检查网络后重试')
    })
  })

  describe('response interceptor — 4xx with message', () => {
    it('on 400 with response.data.message: calls toast.error with that message', async () => {
      const error = {
        response: { status: 400, data: { message: '参数错误' } },
        config: {}
      }

      await expect(responseErrorHandler(error)).rejects.toBe(error)
      expect(mockToast.error).toHaveBeenCalledWith('参数错误')
    })

    it('on 422 without message: calls toast.error with "操作失败"', async () => {
      const error = {
        response: { status: 422, data: {} },
        config: {}
      }

      await expect(responseErrorHandler(error)).rejects.toBe(error)
      expect(mockToast.error).toHaveBeenCalledWith('操作失败')
    })
  })

  describe('response interceptor — skipErrorToast on non-401 errors', () => {
    it('on 500 with skipErrorToast: skips toast', async () => {
      const error = {
        response: { status: 500, data: {} },
        config: { skipErrorToast: true }
      }

      await expect(responseErrorHandler(error)).rejects.toBe(error)
      expect(mockToast.error).not.toHaveBeenCalled()
    })
  })
})

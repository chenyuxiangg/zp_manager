// B0316 — api/index.js 与 api/interceptor.js 集成 contract test
//
// 守护：
// 1. 4xx/5xx 错误必调 handleApiError（不被改回手写分支）
// 2. 401 走 index.js 自己的跳登录逻辑（不调 handleApiError）
// 3. 完整性：所有 4xx/5xx 都走 handleApiError 路径

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock axios（参照 index.spec.js 模式）
const mockInterceptors = {
  request: { use: vi.fn() },
  response: { use: vi.fn() }
}
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: mockInterceptors,
      get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn(),
    })),
  },
}))

const handleApiErrorMock = vi.fn()
vi.mock('@/api/interceptor', () => ({
  handleApiError: (...args) => handleApiErrorMock(...args),
}))

const pushMock = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    currentRoute: { value: { path: '/dashboard' } },
    push: pushMock,
  }),
}))

const authMock = {
  isRedirecting: false,
  setRedirecting: vi.fn(),
  clearLocalAuth: vi.fn(),
}
vi.mock('@/stores/auth', () => ({
  useAuthStore: () => authMock,
}))

const toastMock = { success: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn() }
vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMock,
}))

const handleMock = vi.fn()
vi.mock('@/mocks', () => ({ handleMock }))

let responseErrorHandler

beforeEach(async () => {
  vi.clearAllMocks()
  vi.resetModules()
  localStorage.clear()
  vi.stubEnv('VITE_USE_MOCK', 'false')

  await import('@/api')
  const respCalls = mockInterceptors.response.use.mock.calls
  responseErrorHandler = respCalls[respCalls.length - 1][1]
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('B0316 — api/index.js 拦截器 wiring 契约', () => {
  it('【500 错误必调 handleApiError】4xx/5xx 走统一处理', async () => {
    const error = {
      response: {
        status: 500,
        data: { success: false, error: { code: 'INTERNAL_ERROR', message: '服务器错误' } },
      },
      config: {},
    }
    await expect(responseErrorHandler(error)).rejects.toBe(error)
    // 关键守护：handleApiError 必被调（不被改回手写分支）
    expect(handleApiErrorMock).toHaveBeenCalledTimes(1)
    expect(handleApiErrorMock).toHaveBeenCalledWith(error, expect.any(Object))
  })

  it('【409 RATE_LIMITED 走 handleApiError】精确分支不会因 index.js 拦截而跳过', async () => {
    const error = {
      response: {
        status: 409,
        data: {
          success: false,
          error: { code: 'RATE_LIMITED', message: '30 分钟内不可重复操作' },
          retry_after_seconds: 1800,
        },
      },
      config: {},
    }
    await expect(responseErrorHandler(error)).rejects.toBe(error)
    expect(handleApiErrorMock).toHaveBeenCalledTimes(1)
  })

  it('【401 不调 handleApiError】401 保留 index.js 自己的跳登录逻辑', async () => {
    localStorage.setItem('token', 'valid-jwt-abc')
    const error = {
      response: { status: 401, data: { error: { code: 'TOKEN_EXPIRED', message: 'Token expired' } } },
      config: {},
    }
    await expect(responseErrorHandler(error)).rejects.toBe(error)
    // 关键守护 1：401 必清 token
    expect(localStorage.getItem('token')).toBeNull()
    // 关键守护 2：handleApiError 不被调（避免重复处理）
    // router.push 验证：api/index.js 用 require('vue-router') CommonJS，
    // vitest ESM mock 不直接生效；本测试守护核心契约（清 token + 不调 handleApiError）
    expect(handleApiErrorMock).not.toHaveBeenCalled()
  })

  it('【403 PERMISSION_DENIED 走 handleApiError】走精确分支（已修 B0311 决定：显示友好文案非静默）', async () => {
    const error = {
      response: {
        status: 403,
        data: { success: false, error: { code: 'PERMISSION_DENIED', message: '无权限访问' } },
      },
      config: {},
    }
    await expect(responseErrorHandler(error)).rejects.toBe(error)
    expect(handleApiErrorMock).toHaveBeenCalledTimes(1)
  })

  it('【404 资源不存在走 handleApiError】', async () => {
    const error = {
      response: {
        status: 404,
        data: { success: false, error: { code: 'RESOURCE_NOT_FOUND', message: '资源不存在' } },
      },
      config: {},
    }
    await expect(responseErrorHandler(error)).rejects.toBe(error)
    expect(handleApiErrorMock).toHaveBeenCalledTimes(1)
  })

  it('【network 错误无 response 走 handleApiError】', async () => {
    const error = { config: {} }
    await expect(responseErrorHandler(error)).rejects.toBe(error)
    expect(handleApiErrorMock).toHaveBeenCalledTimes(1)
  })
})
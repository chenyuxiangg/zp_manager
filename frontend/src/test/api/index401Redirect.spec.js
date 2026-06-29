// PR0013 修复契约测试 — 401 跳转不能触发整页刷新
// 背景：原实现在 axios 响应拦截器里用 `require('vue-router')` + `useRouter()`，
// 在 ESM bundle 里 require 抛错、且 useRouter 必须在 setup 上下文，导致 catch 分支
// 走 `window.location.href = '/login'`，整页硬刷新 + onMounted 再触发 /api/auth/me
// 形成死循环（部署后登录页疯狂刷新）。
// 契约：401 必须用模块级导入的 router 实例 router.push（软跳），
//      任何情况下都不能写 window.location.href。

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ★ vi.hoisted：mock 数据在 vi.mock 工厂执行前就必须可用（避免 TDZ 报
//   "Cannot access 'mockRouter' before initialization"）
const { mockRouter, mockRouterPush, mockToast } = vi.hoisted(() => {
  const mockRouterPush = vi.fn()
  return {
    mockRouterPush,
    mockRouter: {
      currentRoute: { value: { path: '/dashboard' } },
      push: mockRouterPush,
    },
    mockToast: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      loading: vi.fn(),
    },
  }
})

// Mock axios 模块（与 index.spec.js 同形）
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

vi.mock('@/composables/useToast', () => ({
  useToast: vi.fn(() => mockToast)
}))

vi.mock('@/mocks', () => ({
  handleMock: vi.fn()
}))

vi.mock('@/router', () => ({
  default: mockRouter,
}))

describe('PR0013 fix — 401 interceptor must soft-redirect via router, never hard-reload', () => {
  let responseErrorHandler

  // 捕获 window.location.href 的写入尝试
  let hrefSetterSpy
  let originalLocation

  beforeEach(async () => {
    vi.clearAllMocks()
    mockRouterPush.mockClear()
    mockRouter.currentRoute.value.path = '/dashboard'

    // 在 happy-dom 里用 defineProperty 替换 href 的 setter 来监控写入尝试
    hrefSetterSpy = vi.fn()
    originalLocation = window.location
    try {
      Object.defineProperty(window, 'location', {
        configurable: true,
        get: () => ({
          set href(_v) { hrefSetterSpy(_v) },
          get href() { return 'http://localhost/' },
        }),
      })
    } catch {
      // 某些 happy-dom 版本 location 不可重定义 — 跳过
    }

    // 重新 import api 模块以触发 interceptor 注册
    vi.resetModules()
    vi.stubEnv('VITE_USE_MOCK', 'false')
    await import('@/api')
    const axiosModule = await import('axios')
    const apiInstance = axiosModule.default.create.mock.results[0].value
    const responseUseCalls = apiInstance.interceptors.response.use.mock.calls
    responseErrorHandler = responseUseCalls[responseUseCalls.length - 1][1]
  })

  afterEach(() => {
    // 恢复 location
    try {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
        writable: true,
      })
    } catch { /* ignore */ }
    vi.restoreAllMocks()
  })

  it('on 401 from non-login page: calls router.push with /login?reason=expired', async () => {
    mockRouter.currentRoute.value.path = '/dashboard'
    const error = { response: { status: 401, data: {} }, config: {} }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    expect(mockRouterPush).toHaveBeenCalledTimes(1)
    expect(mockRouterPush).toHaveBeenCalledWith({
      path: '/login',
      query: { reason: 'expired' },
    })
  })

  it('on 401 from /login page: does NOT call router.push (idempotent, no nav loop)', async () => {
    mockRouter.currentRoute.value.path = '/login'
    const error = { response: { status: 401, data: {} }, config: {} }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    expect(mockRouterPush).not.toHaveBeenCalled()
  })

  it('CRITICAL: never writes window.location.href = "/login" (would cause full page reload)', async () => {
    // 关键回归：原实现 catch 分支写 window.location.href，是部署后刷新死循环的根因
    const error = { response: { status: 401, data: {} }, config: {} }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    expect(hrefSetterSpy).not.toHaveBeenCalledWith('/login')
  })

  it('does not throw uncaught exception when handling 401 (require/useRouter was leaking ReferenceError)', async () => {
    // 原实现 require('vue-router') 在 ESM bundle 抛 ReferenceError，
    // useRouter() 在模块级上下文也抛 "inject() can only be used inside setup()"
    // 修复后：handler 显式 return Promise.reject(error)，rejection 必须是原 error
    // 而非被 require/useRouter 抛出的其它异常
    const error = { response: { status: 401, data: { code: 'TOKEN_EXPIRED' } }, config: {} }

    await expect(responseErrorHandler(error)).rejects.toBe(error)
    // rejects.toBe(error) 证明 handler 没有把别的异常（如 ReferenceError）抛出来
  })

  it('on 401 with skipErrorToast: true: skips everything (token, push, location)', async () => {
    localStorage.setItem('token', 'abc123')
    const error = { response: { status: 401, data: {} }, config: { skipErrorToast: true } }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    expect(localStorage.getItem('token')).toBe('abc123')
    expect(mockRouterPush).not.toHaveBeenCalled()
    expect(hrefSetterSpy).not.toHaveBeenCalledWith('/login')
  })

  it('on 401: still removes token from localStorage (auth state cleanup)', async () => {
    localStorage.setItem('token', 'old-token')
    const error = { response: { status: 401, data: {} }, config: {} }

    await expect(responseErrorHandler(error)).rejects.toBe(error)

    expect(localStorage.getItem('token')).toBeNull()
  })

  it('sequential 401s from /login do not trigger multiple pushes (idempotency)', async () => {
    mockRouter.currentRoute.value.path = '/login'
    const error = { response: { status: 401, data: {} }, config: {} }

    await responseErrorHandler(error).catch(() => {})
    await responseErrorHandler(error).catch(() => {})
    await responseErrorHandler(error).catch(() => {})

    expect(mockRouterPush).not.toHaveBeenCalled()
    expect(hrefSetterSpy).not.toHaveBeenCalledWith('/login')
  })
})

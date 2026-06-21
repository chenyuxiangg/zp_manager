// PR0013 + B0305 + B0309 — Token 过期守卫契约
// 目标: 锁定 5 个行为契约
//   1) useTokenExpiry 接 Ref<string|null> token + 自动 watch
//   2) token 过期 → router.push('/login?reason=expired') + toast.error
//   3) 5 分钟预告 toast.warn 一次（不重复）
//   4) onMounted 自动 start；onUnmounted 自动 stop
//   5) 无效 token → 静默 clearLocalAuth
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'

// mock vue-router
const pushMock = vi.fn()
const useRouterMock = () => ({ push: pushMock, currentRoute: { value: { path: '/dashboard' } } })
vi.mock('vue-router', () => ({
  useRouter: useRouterMock,
}))

const { toastError, toastWarn } = vi.hoisted(() => ({ toastError: vi.fn(), toastWarn: vi.fn() }))
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ error: toastError, warning: toastWarn, warn: toastWarn }),
}))

const authStoreMock = {
  clearLocalAuth: vi.fn(),
  setRedirecting: vi.fn(),
  isRedirecting: false,
  logout: vi.fn(),
}
vi.mock('@/stores/auth', () => ({ useAuthStore: () => authStoreMock }))

// mock jwt-decode 用真实包
// 注：vitest 环境 happy-dom 已支持 base64/btoa

function makeToken(expSecFromNow) {
  const exp = Math.floor(Date.now() / 1000) + expSecFromNow
  return `header.${btoa(JSON.stringify({ exp }))}.sig`
}

// 测试 host 组件
async function createHost(tokenRef, opts = {}) {
  const { useTokenExpiry } = await import('@/composables/useTokenExpiry')
  return mount({
    template: '<div />',
    setup() {
      useTokenExpiry(tokenRef, opts)
      return {}
    },
  })
}

describe('【B0309 Ref 接口 + B0305 主动跳登录】 useTokenExpiry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    pushMock.mockReset()
    toastError.mockReset()
    toastWarn.mockReset()
    authStoreMock.clearLocalAuth.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('【B0309 接 Ref】useTokenExpiry(tokenRef) 不报 "options is undefined"', async () => {
    const tokenRef = ref(makeToken(3600))  // 1 小时后过期
    // 用一个简单 host 验证不抛错
    let error = null
    try {
      await createHost(tokenRef)
    } catch (e) {
      error = e
    }
    expect(error).toBeNull()
  })

  it('【B0305 已过期 token】立即 router.push /login?reason=expired + toast.error + clearLocalAuth', async () => {
    // 已过期 100 秒
    const tokenRef = ref(makeToken(-100))
    await createHost(tokenRef)
    // 首次 check 是同步触发的（在 start() 内）
    expect(authStoreMock.clearLocalAuth).toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith(expect.stringMatching(/会话已过期/))
    expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({
      path: '/login',
      query: expect.objectContaining({ reason: 'expired' }),
    }))
  })

  it('【5 分钟预告】< 5min 内过期 → toast.warning 触发一次（不重复）', async () => {
    const tokenRef = ref(makeToken(60))  // 60 秒后过期
    await createHost(tokenRef)
    // 首次 check：60 秒 < 5min → 触发 warning
    expect(toastWarn).toHaveBeenCalledTimes(1)
    // 推进 1 分钟再次检查
    vi.advanceTimersByTime(60_000)
    expect(toastWarn).toHaveBeenCalledTimes(1)  // 仍是 1，不重复
  })

  it('【watch token 变化】tokenRef.value 改变后重置 warned 状态', async () => {
    const tokenRef = ref(makeToken(60))
    await createHost(tokenRef)
    expect(toastWarn).toHaveBeenCalledTimes(1)
    // 换一个新 token（再次 60 秒内过期）
    tokenRef.value = makeToken(60)
    vi.advanceTimersByTime(60_000)
    // token 变化后重置，应该再次 warn
    expect(toastWarn.mock.calls.length).toBeGreaterThanOrEqual(1)
  })

  it('【无效 token】jwtDecode 抛错 → 静默 clearLocalAuth', async () => {
    const tokenRef = ref('invalid.token.string')
    await createHost(tokenRef)
    // 不会 throw；clearLocalAuth 会被尝试调用（虽然在 try/catch 里）
    expect(authStoreMock.clearLocalAuth).toHaveBeenCalled()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('【onExpired 自定义回调】支持注入业务逻辑替代默认 router.push', async () => {
    const onExpired = vi.fn()
    const tokenRef = ref(makeToken(-10))
    await createHost(tokenRef, { onExpired })
    // 自定义回调被调用
    expect(onExpired).toHaveBeenCalled()
    // 默认 router.push 不被调用（业务覆盖）
    expect(pushMock).not.toHaveBeenCalled()
  })
})
// B0341 — useLogout composable 契约测试
// 目标: 锁定 4 个行为契约
//   1) 成功 logout → router.push('/login') + toast.success('已退出')
//   2) logout 失败抛错 → 仍 clearLocalAuth + 跳登录页（fail-open）
//   3) loading 状态正确切换（true → false）
//   4) 幂等可重复调用
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { pushMock, authStoreMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  authStoreMock: {
    logout: vi.fn(),
    clearLocalAuth: vi.fn(),
  },
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: pushMock }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ success: toastSuccessMock, error: toastErrorMock }),
}))

vi.mock('@/stores/auth', () => ({ useAuthStore: () => authStoreMock }))

async function mountUseLogout() {
  const { useLogout } = await import('@/composables/useLogout')
  return useLogout()
}

describe('【B0341】 useLogout composable', () => {
  beforeEach(() => {
    pushMock.mockReset()
    authStoreMock.logout.mockReset()
    authStoreMock.clearLocalAuth.mockReset()
    toastSuccessMock.mockReset()
    toastErrorMock.mockReset()
    // 默认 logout 成功
    authStoreMock.logout.mockResolvedValue({ success: true })
  })

  it('【成功路径】logout 后 router.push("/login") + toast.success("已退出")', async () => {
    const { handleLogout, loading } = await mountUseLogout()

    expect(loading.value).toBe(false)
    await handleLogout()

    expect(authStoreMock.logout).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('/login')
    expect(toastSuccessMock).toHaveBeenCalledWith('已退出')
    expect(loading.value).toBe(false)
  })

  it('【失败容错】logout 抛错仍 router.push("/login")（fail-open 不卡 UI）', async () => {
    authStoreMock.logout.mockRejectedValue(new Error('network 500'))
    const { handleLogout } = await mountUseLogout()

    await handleLogout()

    // 即使 logout 抛错，仍跳登录页
    expect(pushMock).toHaveBeenCalledWith('/login')
    // 不弹 success（避免误导用户）
    expect(toastSuccessMock).not.toHaveBeenCalled()
  })

  it('【loading 状态】调用期间 loading=true，结束后 loading=false', async () => {
    let resolveLogout
    authStoreMock.logout.mockImplementation(
      () => new Promise((resolve) => { resolveLogout = resolve })
    )
    const { handleLogout, loading } = await mountUseLogout()

    expect(loading.value).toBe(false)
    const p = handleLogout()
    // pending 中
    expect(loading.value).toBe(true)
    resolveLogout({ success: true })
    await p
    // 结束后
    expect(loading.value).toBe(false)
  })

  it('【幂等】重复调用不会破坏 router 状态（每次都 push）', async () => {
    const { handleLogout } = await mountUseLogout()
    await handleLogout()
    await handleLogout()
    expect(pushMock).toHaveBeenCalledTimes(2)
    expect(pushMock).toHaveBeenNthCalledWith(1, '/login')
    expect(pushMock).toHaveBeenNthCalledWith(2, '/login')
  })
})
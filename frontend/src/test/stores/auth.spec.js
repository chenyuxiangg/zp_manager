// useAuthStore 测试 - TDD
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupTestPinia } from '@/test/helpers/store-mock'

// Mock @/api 模块
const mockApi = {
  post: vi.fn(),
  get: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn()
}
vi.mock('@/api', () => ({
  default: mockApi
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTestPinia()
  })

  describe('login(email, password)', () => {
    it('calls api.post with { skipErrorToast: true } as third argument', async () => {
      mockApi.post.mockResolvedValue({
        success: true,
        data: { token: 'tok-123', user: { id: 1, email: 'a@b.com' } }
      })

      const { useAuthStore } = await import('@/stores/auth')
      const auth = useAuthStore()
      await auth.login('a@b.com', 'pw')

      expect(mockApi.post).toHaveBeenCalledWith(
        '/auth/login',
        { email: 'a@b.com', password: 'pw' },
        { skipErrorToast: true }
      )
    })

    it('on success: stores token, user, and writes token to localStorage', async () => {
      mockApi.post.mockResolvedValue({
        success: true,
        data: { token: 'tok-xyz', user: { id: 7, username: 'alice' } }
      })

      const { useAuthStore } = await import('@/stores/auth')
      const auth = useAuthStore()
      const res = await auth.login('alice@x.com', 'pw')

      expect(res.success).toBe(true)
      expect(auth.token).toBe('tok-xyz')
      expect(auth.user).toEqual({ id: 7, username: 'alice' })
      expect(localStorage.getItem('token')).toBe('tok-xyz')
    })

    it('on failure: returns res unchanged, does not write localStorage, does not clear existing token', async () => {
      // 先设置已有 token（模拟已登录用户重新登录失败场景）
      localStorage.setItem('token', 'pre-existing')

      const failRes = {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码不正确' }
      }
      mockApi.post.mockResolvedValue(failRes)

      const { useAuthStore } = await import('@/stores/auth')
      const auth = useAuthStore()
      const res = await auth.login('a@b.com', 'wrong')

      expect(res).toBe(failRes)
      // 已有的 token 不被清空（store 初始化时从 localStorage 读取）
      expect(auth.token).toBe('pre-existing')
      expect(auth.user).toBeNull()
      expect(localStorage.getItem('token')).toBe('pre-existing')
    })
  })

  describe('register() — regression', () => {
    it('still calls api.post with only 2 args (no skipErrorToast)', async () => {
      mockApi.post.mockResolvedValue({
        success: true,
        data: { token: 'tok-reg', user: { id: 1 } }
      })

      const { useAuthStore } = await import('@/stores/auth')
      const auth = useAuthStore()
      await auth.register('alice', 'a@b.com', 'pw')

      // register 仍只传 url + data，不带 skipErrorToast
      expect(mockApi.post).toHaveBeenCalledWith(
        '/auth/register',
        { username: 'alice', email: 'a@b.com', password: 'pw' }
      )
      // 第三个参数（config）不应是 {skipErrorToast: true}
      const lastCallArgs = mockApi.post.mock.calls[0]
      expect(lastCallArgs[2]).toBeUndefined()
    })
  })

  describe('fetchUser() — regression', () => {
    it('calls api.get /auth/me and stores user on success', async () => {
      mockApi.get.mockResolvedValue({
        success: true,
        data: { user: { id: 5, username: 'bob' } }
      })

      const { useAuthStore } = await import('@/stores/auth')
      const auth = useAuthStore()
      const res = await auth.fetchUser()

      expect(mockApi.get).toHaveBeenCalledWith('/auth/me')
      expect(res.success).toBe(true)
      expect(auth.user).toEqual({ id: 5, username: 'bob' })
    })

    it('on failure: returns res, does not mutate user', async () => {
      mockApi.get.mockResolvedValue({
        success: false,
        error: { code: 'AUTH_ERROR', message: 'Token expired' }
      })

      const { useAuthStore } = await import('@/stores/auth')
      const auth = useAuthStore()
      const res = await auth.fetchUser()

      expect(res.success).toBe(false)
      expect(auth.user).toBeNull()
    })
  })

  describe('logout() — regression', () => {
    it('clears token and user, removes from localStorage', async () => {
      mockApi.post.mockResolvedValue({ success: true })

      const { useAuthStore } = await import('@/stores/auth')
      const auth = useAuthStore()
      auth.token = 'tok-123'
      auth.user = { id: 1 }
      localStorage.setItem('token', 'tok-123')

      await auth.logout()

      expect(auth.token).toBeNull()
      expect(auth.user).toBeNull()
      expect(localStorage.getItem('token')).toBeNull()
    })

    it('still clears local state even if server call fails', async () => {
      mockApi.post.mockRejectedValue(new Error('Network'))

      const { useAuthStore } = await import('@/stores/auth')
      const auth = useAuthStore()
      auth.token = 'tok-123'
      auth.user = { id: 1 }

      await auth.logout()

      expect(auth.token).toBeNull()
      expect(auth.user).toBeNull()
    })
  })
})

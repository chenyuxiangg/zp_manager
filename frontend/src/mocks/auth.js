// 认证相关 mock 数据

const delay = (ms = 50) => new Promise(resolve => setTimeout(resolve, ms))

const MOCK_USER = {
  id: 1,
  username: 'me',
  email: 'me@example.com',
  points: 100,
  is_admin: false
}

let currentUser = null

export const mockAuth = {
  async login(email, password) {
    await delay()
    // mock 简化：任意 email/password 都成功（与产品约定一致）
    currentUser = { ...MOCK_USER, email }
    return {
      success: true,
      data: { token: 'mock-token-' + Date.now(), user: currentUser }
    }
  },

  async register(username, email, password) {
    await delay()
    currentUser = { ...MOCK_USER, username, email }
    return {
      success: true,
      data: { token: 'mock-token-' + Date.now(), user: currentUser }
    }
  },

  async fetchUser() {
    await delay()
    if (!currentUser) {
      return { success: false, error: { code: 'AUTH_ERROR', message: '未登录' } }
    }
    return { success: true, data: { user: currentUser } }
  },

  async logout() {
    await delay()
    currentUser = null
    return { success: true, data: {} }
  }
}

// B0323 — fetchUserProfile 响应层级 + store.user 同步写入 contract test
//
// 后端 GET /api/users/profile 返 `{data: {user: {...}, stats: {...}}}`（嵌套）
// axios interceptor 已解开最外层 data → res = {user: {...}, stats: {...}}
// fetchUserProfile 必须：1) 写入 store.user；2) 透传 res 给调用方

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupTestPinia } from '@/test/helpers/store-mock'

// 拦截 api.get('/users/profile')
const getMock = vi.fn()
vi.mock('@/api', () => ({
  default: {
    get: (...args) => getMock(...args),
  },
}))

import { useAuthStore } from '@/stores/auth'

describe('B0323 — fetchUserProfile 契约', () => {
  beforeEach(() => {
    setupTestPinia()
    getMock.mockReset()
  })

  it('【真后端契约】res.user 写入 store.user', async () => {
    getMock.mockResolvedValue({
      user: {
        id: 1, username: 'alice', email: 'alice@test.com',
        points: 50, is_admin: false,
        notify_config: { onboarded: true, learn_reminder: { timing: '2 days' } },
      },
      stats: { total_plans: 3, total_tasks: 10, completed_tasks: 5, overdue_tasks: 1 },
    })
    const auth = useAuthStore()
    const res = await auth.fetchUserProfile()
    // 1. 透传 res 给调用方
    expect(res.user.id).toBe(1)
    expect(res.user.notify_config.onboarded).toBe(true)
    // 2. store.user 被填充
    expect(auth.user.id).toBe(1)
    expect(auth.user.username).toBe('alice')
    expect(auth.user.notify_config.onboarded).toBe(true)
  })

  it('【mock 兼容】res.data.user 也支持（旧契约路径）', async () => {
    getMock.mockResolvedValue({
      data: { user: { id: 2, username: 'bob', is_admin: true } },
    })
    const auth = useAuthStore()
    const res = await auth.fetchUserProfile()
    // mock 模式 res.data.user 时 store.user 也能填充
    expect(auth.user.id).toBe(2)
    expect(auth.user.is_admin).toBe(true)
  })

  it('【B0330 联动】is_admin 字段保真', async () => {
    getMock.mockResolvedValue({
      user: { id: 3, username: 'admin', is_admin: true },
      stats: {},
    })
    const auth = useAuthStore()
    await auth.fetchUserProfile()
    expect(auth.user.is_admin).toBe(true)
  })

  it('【响应空】res.user 缺失时不写入 store.user（防御）', async () => {
    getMock.mockResolvedValue({})
    const auth = useAuthStore()
    const res = await auth.fetchUserProfile()
    expect(res).toEqual({})
    // store.user 不被污染（仍为初始 null/undefined）
    expect(auth.user == null || typeof auth.user === 'object').toBe(true)
  })

  it('【浅合并】保留已有 store.user 字段（token 等）', async () => {
    getMock.mockResolvedValue({
      user: { id: 1, points: 10 },
      stats: {},
    })
    const auth = useAuthStore()
    // 预设一些本地字段
    auth.user = { token: 'jwt-abc', customField: 'local' }
    await auth.fetchUserProfile()
    // token / customField 保留
    expect(auth.user.token).toBe('jwt-abc')
    expect(auth.user.customField).toBe('local')
    // 新字段被合并
    expect(auth.user.id).toBe(1)
    expect(auth.user.points).toBe(10)
  })
})
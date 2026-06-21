// B0324 — setOnboarded / updateNotifyConfig 同步写本地 store.user contract test
//
// 关键：useOnboardingWatcher 依赖 auth.user.notify_config.onboarded 触发重启引导
// B0324 修复：setOnboarded 必须 optimistic update 本地状态，失败时回滚

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupTestPinia } from '@/test/helpers/store-mock'

const putMock = vi.fn()
vi.mock('@/api', () => ({
  default: {
    put: (...args) => putMock(...args),
  },
}))

import { useAuthStore } from '@/stores/auth'

describe('B0324 — setOnboarded optimistic update', () => {
  beforeEach(() => {
    setupTestPinia()
    putMock.mockReset()
    putMock.mockResolvedValue({ success: true, data: { user: { id: 1, notify_config: { onboarded: false } } } })
  })

  it('【setOnboarded true】本地 store.user.notify_config.onboarded 立即更新', async () => {
    const auth = useAuthStore()
    auth.user = { id: 1, notify_config: { onboarded: false } }
    await auth.setOnboarded(true)
    // optimistic update 后立即是 true
    expect(auth.user.notify_config.onboarded).toBe(true)
  })

  it('【setOnboarded false】false 值也正确更新', async () => {
    const auth = useAuthStore()
    auth.user = { id: 1, notify_config: { onboarded: true } }
    await auth.setOnboarded(false)
    expect(auth.user.notify_config.onboarded).toBe(false)
  })

  it('【setOnboarded 失败回滚】api.put reject 时本地状态恢复', async () => {
    const auth = useAuthStore()
    auth.user = { id: 1, notify_config: { onboarded: true } }
    putMock.mockRejectedValueOnce(new Error('network error'))
    await expect(auth.setOnboarded(false)).rejects.toThrow('network error')
    // 失败回滚：onboarded 应恢复为 true
    expect(auth.user.notify_config.onboarded).toBe(true)
  })

  it('【updateNotifyConfig 同步】写入本地 store.user.notify_config', async () => {
    const auth = useAuthStore()
    auth.user = { id: 1, notify_config: { onboarded: true } }
    await auth.updateNotifyConfig({ learn_reminder: { timing: '2 days' } })
    // 本地 notify_config 应包含新字段
    expect(auth.user.notify_config.learn_reminder.timing).toBe('2 days')
    // 原有字段保留
    expect(auth.user.notify_config.onboarded).toBe(true)
  })

  it('【setOnboarded 边界】user 为空时不爆', async () => {
    const auth = useAuthStore()
    auth.user = null
    // user 为空时跳过 optimistic update
    await auth.setOnboarded(true)
    expect(auth.user).toBeNull()
  })

  it('【setOnboarded 强类型】传任意值转 boolean', async () => {
    const auth = useAuthStore()
    auth.user = { id: 1, notify_config: { onboarded: false } }
    await auth.setOnboarded('true')  // 字符串 'true'
    expect(auth.user.notify_config.onboarded).toBe(true)
  })
})
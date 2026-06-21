// B0320 — updateNotifyConfig / setOnboarded 请求体形状契约测试
//
// 后端 PUT /users/notify-config 期望 `{notify_config: {...}}` 嵌套形状（见
// `backend/routes/users.py:40` `data.get('notify_config')`）。前端直接传
// 顶层 config 会被忽略，导致 Settings 自定义字段被静默丢弃。

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupTestPinia } from '@/test/helpers/store-mock'

// 拦截 api.put，捕获实际请求体
const putMock = vi.fn()
vi.mock('@/api', () => ({
  default: {
    put: (...args) => putMock(...args),
  },
}))

import { useAuthStore } from '@/stores/auth'

describe('B0320 — updateNotifyConfig / setOnboarded 请求体形状契约', () => {
  beforeEach(() => {
    setupTestPinia()
    putMock.mockReset()
    putMock.mockResolvedValue({ success: true, data: { user: { id: 1, notify_config: {} } } })
  })

  it('【updateNotifyConfig】必须包成 {notify_config: {...}} 嵌套形状', async () => {
    const auth = useAuthStore()
    const config = {
      learn_reminder: { timing: '2 days', channels: ['email'] },
      onboarded: false,
      pomodoro: { break_enabled: true, break_minutes: 5, background_keep_alive: true },
      streak: { next_milestone: 7, flame_visible: true },
    }
    await auth.updateNotifyConfig(config)
    expect(putMock).toHaveBeenCalledTimes(1)
    const [url, body] = putMock.mock.calls[0]
    expect(url).toBe('/users/notify-config')
    expect(body).toEqual({ notify_config: config })
    // 关键守护：顶层不应有 notify_config 之外的字段
    expect(Object.keys(body)).toEqual(['notify_config'])
  })

  it('【setOnboarded】必须包成 {notify_config: {onboarded: bool}} 嵌套形状', async () => {
    const auth = useAuthStore()
    await auth.setOnboarded(false)
    expect(putMock).toHaveBeenCalledTimes(1)
    const [url, body] = putMock.mock.calls[0]
    expect(url).toBe('/users/notify-config')
    expect(body).toEqual({ notify_config: { onboarded: false } })
  })

  it('【setOnboarded true】同上嵌套形状', async () => {
    const auth = useAuthStore()
    await auth.setOnboarded(true)
    expect(putMock.mock.calls[0][1]).toEqual({ notify_config: { onboarded: true } })
  })

  it('【updateNotifyConfig 自定义字段必须存在】避免后端静默丢弃', async () => {
    // 关键回归守护：之前直接传 config 顶层，learn_reminder/pomodoro/streak 会被后端 .get('notify_config') 忽略
    const auth = useAuthStore()
    const customConfig = {
      learn_reminder: { timing: '3 days', channels: ['email', 'wechat'] },
      pomodoro: { break_enabled: false, break_minutes: 10 },
      streak: { next_milestone: 30 },
    }
    await auth.updateNotifyConfig(customConfig)
    const body = putMock.mock.calls[0][1]
    // 所有自定义字段都在 notify_config 嵌套下，后端能正确读取
    expect(body.notify_config.learn_reminder.timing).toBe('3 days')
    expect(body.notify_config.pomodoro.break_minutes).toBe(10)
    expect(body.notify_config.streak.next_milestone).toBe(30)
  })
})
// PR0022 + v2.18 — useNotifyConfig composable 测试
// v2.18: 走 authStore actions (B0303 彻底化)，不再 mock raw api

import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock auth store actions
const { updateNotifyConfigMock, setOnboardedMock, fetchUserProfileMock, previewNotifyFrequencyMock } = vi.hoisted(() => ({
  updateNotifyConfigMock: vi.fn(),
  setOnboardedMock: vi.fn(),
  fetchUserProfileMock: vi.fn(),
  previewNotifyFrequencyMock: vi.fn(),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: () => ({
    updateNotifyConfig: updateNotifyConfigMock,
    setOnboarded: setOnboardedMock,
    fetchUserProfile: fetchUserProfileMock,
    previewNotifyFrequency: previewNotifyFrequencyMock,
  }),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

import { useNotifyConfig, DEFAULTS } from '@/composables/useNotifyConfig'

describe('PR0022 + v2.18 — useNotifyConfig composable', () => {
  beforeEach(() => {
    updateNotifyConfigMock.mockReset()
    setOnboardedMock.mockReset()
    fetchUserProfileMock.mockReset()
    previewNotifyFrequencyMock.mockReset()
  })

  it('【默认值】导出 DEFAULTS 含 learn/verify/onboarded/pomodoro/streak 5 段', () => {
    expect(DEFAULTS).toMatchObject({
      learn_reminder: { timing: '1 day', channels: ['email'] },
      verify_reminder: { timing: '3 days', channels: ['email'] },
      onboarded: false,
      pomodoro: {
        break_enabled: true,
        break_minutes: 5,
        background_keep_alive: true,
      },
      streak: {
        next_milestone: 7,
        flame_visible: true,
      },
    })
  })

  it('【merge】缺字段时回退到默认 (向后兼容老 JSON)', () => {
    const { mergeWithDefaults } = useNotifyConfig()
    const oldJson = {
      learn_reminder: { timing: '1 day', channels: ['email'] },
      verify_reminder: { timing: '3 days', channels: ['email'] },
    }
    const merged = mergeWithDefaults(oldJson)
    expect(merged.onboarded).toBe(false)
    expect(merged.pomodoro.break_enabled).toBe(true)
    expect(merged.streak.next_milestone).toBe(7)
  })

  it('【v2.18 update】调 authStore.updateNotifyConfig 整块 JSON (B0303)', async () => {
    updateNotifyConfigMock.mockResolvedValue({ data: { ok: true } })
    const { update, config } = useNotifyConfig()
    config.value = { ...DEFAULTS, pomodoro: { ...DEFAULTS.pomodoro, break_enabled: false } }
    await update()
    expect(updateNotifyConfigMock).toHaveBeenCalledTimes(1)
    expect(updateNotifyConfigMock.mock.calls[0][0]).toMatchObject({
      pomodoro: { break_enabled: false, break_minutes: 5, background_keep_alive: true },
    })
  })

  it('【B0320 update 端点形状】authStore.updateNotifyConfig 传整块 config（B0303 契约）', async () => {
    updateNotifyConfigMock.mockResolvedValue({ data: { ok: true } })
    const { update, config } = useNotifyConfig()
    config.value = { ...DEFAULTS, onboarded: true }
    await update()
    // store action 接收原始 config（无嵌套包装由 store 内部完成）— 本测试仅守护 B0303 契约
    expect(updateNotifyConfigMock.mock.calls[0][0].onboarded).toBe(true)
  })

  it('【v2.18 markOnboarded】调 authStore.setOnboarded 统一端点 (B0304 PUT)', async () => {
    setOnboardedMock.mockResolvedValue({ data: { onboarded: false } })
    const { markOnboarded, config } = useNotifyConfig()
    await markOnboarded(false)
    expect(setOnboardedMock).toHaveBeenCalledTimes(1)
    expect(setOnboardedMock).toHaveBeenCalledWith(false)
    // 本地同步
    expect(config.value.onboarded).toBe(false)
  })

  it('【v2.18 previewFrequency】调 authStore.previewNotifyFrequency 返 estimated_per_week', async () => {
    previewNotifyFrequencyMock.mockResolvedValue({ data: { estimated_per_week: 7 } })
    const { previewFrequency } = useNotifyConfig()
    const result = await previewFrequency('2026-06-01', '2026-06-30')
    expect(previewNotifyFrequencyMock).toHaveBeenCalledTimes(1)
    expect(previewNotifyFrequencyMock.mock.calls[0][0]).toEqual({ from: '2026-06-01', to: '2026-06-30' })
    expect(result).toBe(7)
  })

  it('【v2.18 load】调 authStore.fetchUserProfile 并 merge notify_config', async () => {
    // B0323: 真后端响应嵌套结构 {user: {notify_config: {...}}, stats: {...}}
    fetchUserProfileMock.mockResolvedValue({
      user: { id: 1, notify_config: { onboarded: true } },
      stats: {},
    })
    const { load, config } = useNotifyConfig()
    await load()
    expect(fetchUserProfileMock).toHaveBeenCalled()
    expect(config.value.onboarded).toBe(true)
    // 缺字段回退默认
    expect(config.value.pomodoro.break_minutes).toBe(5)
  })

  it('【B0323 load 三层 fallback】mock 旧形状 res.data.user 也能读', async () => {
    // 兼容 mock 模式 / 旧契约
    fetchUserProfileMock.mockResolvedValue({
      data: { user: { notify_config: { onboarded: false, learn_reminder: { timing: '3 days' } } } },
    })
    const { load, config } = useNotifyConfig()
    await load()
    expect(config.value.onboarded).toBe(false)
    expect(config.value.learn_reminder.timing).toBe('3 days')
  })
})
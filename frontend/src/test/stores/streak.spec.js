// PR0009 + B0328-fix — Streak 显示 + stores/streak.js
// 目标: 锁定 5 个行为契约
//   1) fetchStreak 调 GET /users/streak + 缓存 5min
//   2) 响应 schema 完整 (current/longest/days_to_7/30/100/last_broken_at) ← B0328
//   3) milestone 计算 (next_milestone + days_to_next 从 state 读，不再 hardcode) ← B0328
//   4) clearStreak 重置（含 daysTo7/30/100） ← B0328
//   5) 旧 localStorage 缺 daysTo 字段 → ?? 0 兜底

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupTestPinia } from '@/test/helpers/store-mock'

const getMock = vi.fn()
vi.mock('@/api', () => ({ default: { get: getMock } }))

const STORAGE_KEY = 'zpersion.streak'

describe('PR0009 + B0328-fix — useStreakStore 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTestPinia()
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  })

  it('【fetchStreak】调 GET /users/streak', async () => {
    getMock.mockResolvedValue({
      data: { current: 5, longest: 10, days_to_7: 2, days_to_30: 25, days_to_100: 95, last_broken_at: null },
    })
    const { useStreakStore } = await import('@/stores/streak')
    const store = useStreakStore()
    await store.fetchStreak(true)
    expect(getMock).toHaveBeenCalledWith('/users/streak')
    expect(store.current).toBe(5)
    expect(store.longest).toBe(10)
    expect(store.daysToNextMilestone).toBe(2)
  })

  it('【缓存】5 分钟内不重复调 API', async () => {
    getMock.mockResolvedValue({ data: { current: 3, longest: 8, days_to_7: 4, days_to_30: 27, days_to_100: 97 } })
    const { useStreakStore } = await import('@/stores/streak')
    const store = useStreakStore()
    await store.fetchStreak(true)
    await store.fetchStreak(false)
    await store.fetchStreak(false)
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('【强制刷新】force=true 时绕过缓存', async () => {
    getMock.mockResolvedValue({ data: { current: 1, longest: 2, days_to_7: 6, days_to_30: 29, days_to_100: 99 } })
    const { useStreakStore } = await import('@/stores/streak')
    const store = useStreakStore()
    await store.fetchStreak(true)
    await store.fetchStreak(true)
    expect(getMock).toHaveBeenCalledTimes(2)
  })

  it('【next_milestone】current<7 → 7；<30 → 30；<100 → 100；≥100 → null', async () => {
    getMock.mockResolvedValue({ data: { current: 4, longest: 4, days_to_7: 3, days_to_30: 26, days_to_100: 96 } })
    const { useStreakStore } = await import('@/stores/streak')
    const store = useStreakStore()
    await store.fetchStreak(true)
    expect(store.nextMilestone).toBe(7)
    expect(store.daysToNextMilestone).toBe(3)

    // 模拟达成 7 天（daysTo7=0, daysTo30=23）
    store.daysTo7 = 0
    store.daysTo30 = 23
    expect(store.nextMilestone).toBe(30)
    expect(store.daysToNextMilestone).toBe(23)

    // 模拟达成 30 天（daysTo30=0, daysTo100=70）
    store.daysTo30 = 0
    store.daysTo100 = 70
    expect(store.nextMilestone).toBe(100)
    expect(store.daysToNextMilestone).toBe(70)

    // 模拟达成 100 天（全部 0）
    store.daysTo100 = 0
    expect(store.nextMilestone).toBeNull()
    expect(store.daysToNextMilestone).toBe(0)
  })

  it('【clearStreak】清 store + localStorage', async () => {
    getMock.mockResolvedValue({ data: { current: 5, longest: 10, days_to_7: 2, days_to_30: 25, days_to_100: 95 } })
    const { useStreakStore } = await import('@/stores/streak')
    const store = useStreakStore()
    await store.fetchStreak(true)
    store.clearStreak()
    expect(store.current).toBe(0)
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  // ── B0328-fix 新增 4 个契约 ─────────────────────────────────────────
  describe('【B0328-fix】消费后端 days_to_7/30/100 字段', () => {
    it('fetchStreak 写入 daysTo7/daysTo30/daysTo100 state', async () => {
      getMock.mockResolvedValue({
        data: { current: 5, longest: 12, days_to_7: 2, days_to_30: 25, days_to_100: 95, last_broken_at: null },
      })
      const { useStreakStore } = await import('@/stores/streak')
      const store = useStreakStore()
      await store.fetchStreak(true)
      expect(store.daysTo7).toBe(2)
      expect(store.daysTo30).toBe(25)
      expect(store.daysTo100).toBe(95)
    })

    it('nextMilestone getter 读 state（不再 hardcode）', async () => {
      // 防御性测试：硬确保 getter 逻辑依赖 state.daysToN 而非 state.current
      getMock.mockResolvedValue({ data: { current: 0, longest: 0, days_to_7: 7, days_to_30: 30, days_to_100: 100 } })
      const { useStreakStore } = await import('@/stores/streak')
      const store = useStreakStore()
      await store.fetchStreak(true)
      expect(store.nextMilestone).toBe(7)
      // 仅改 state.daysTo7 = 0（不直接改 current）应触发 milestone 升级到 30
      store.daysTo7 = 0
      expect(store.nextMilestone).toBe(30)
    })

    it('daysToNextMilestone getter 读 state（不再 hardcode）', async () => {
      getMock.mockResolvedValue({ data: { current: 0, longest: 0, days_to_7: 5, days_to_30: 30, days_to_100: 100 } })
      const { useStreakStore } = await import('@/stores/streak')
      const store = useStreakStore()
      await store.fetchStreak(true)
      expect(store.daysToNextMilestone).toBe(5)
      // 仅改 state.daysTo7（不直接改 current）应反映到 daysToNextMilestone
      store.daysTo7 = 3
      expect(store.daysToNextMilestone).toBe(3)
    })

    it('clearStreak 重置 daysTo7/daysTo30/daysTo100', async () => {
      getMock.mockResolvedValue({ data: { current: 5, longest: 12, days_to_7: 2, days_to_30: 25, days_to_100: 95 } })
      const { useStreakStore } = await import('@/stores/streak')
      const store = useStreakStore()
      await store.fetchStreak(true)
      expect(store.daysTo7).toBe(2)
      store.clearStreak()
      expect(store.daysTo7).toBe(0)
      expect(store.daysTo30).toBe(0)
      expect(store.daysTo100).toBe(0)
    })
  })
})

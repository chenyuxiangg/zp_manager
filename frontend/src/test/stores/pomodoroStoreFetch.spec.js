// B0347 — stores/pomodoro.js fetchPomodoroSessions 兼容两端字段名（mock vs 真后端）
//
// 修复要点：
// 1. 真后端 routes/pomodoro.py:list_pomodoros 返 `data.pomodoros` 字段
// 2. mock modules/pomodoro.js:listSessions 返 `data.sessions` 字段
// 3. store 必须 fallback 兼容两端，否则切到真后端模式时 PomodoroHistoryList 永远是空数组

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setupTestPinia } from '@/test/helpers/store-mock'
import { usePomodoroStore } from '@/stores/pomodoro'

const getMock = vi.fn()

vi.mock('@/api', () => ({
  default: { get: (...args) => getMock(...args) },
}))

describe('B0347 — pomodoro store fetchPomodoroSessions 兼容两端字段名', () => {
  beforeEach(() => {
    setupTestPinia()
    getMock.mockReset()
  })

  it('【真后端契约】响应 data.pomodoros 字段 → store.sessions 正确赋值', async () => {
    getMock.mockResolvedValue({
      success: true,
      data: {
        pomodoros: [
          { id: 1, started_at: '2026-07-01T10:00:00', ended_at: '2026-07-01T10:25:00', planned_minutes: 25, actual_seconds: 1500, completed: true, auto_toggled: false },
        ],
        total: 1, page: 1, limit: 50,
      },
    })
    const store = usePomodoroStore()
    const res = await store.fetchPomodoroSessions(42)
    expect(res.success).toBe(true)
    expect(store.sessions).toHaveLength(1)
    expect(store.sessions[0].id).toBe(1)
    expect(store.sessions[0].actual_seconds).toBe(1500)
  })

  it('【mock 契约】响应 data.sessions 字段 → store.sessions 正确赋值', async () => {
    getMock.mockResolvedValue({
      success: true,
      data: {
        sessions: [
          { id: 2, started_at: '2026-07-01T11:00:00', ended_at: null, planned_minutes: 25, actual_seconds: null, completed: false, auto_toggled: false },
        ],
        total: 1, page: 1, limit: 50,
      },
    })
    const store = usePomodoroStore()
    const res = await store.fetchPomodoroSessions(42)
    expect(res.success).toBe(true)
    expect(store.sessions).toHaveLength(1)
    expect(store.sessions[0].id).toBe(2)
  })

  it('【优先级】mock sessions 字段优先（mock 模式）', async () => {
    // 如果两端字段都有，sessions 优先（mock 优先，因为 mock 在 dev 模式常用）
    getMock.mockResolvedValue({
      success: true,
      data: {
        sessions: [{ id: 'mock' }],
        pomodoros: [{ id: 'real' }],
        total: 1, page: 1, limit: 50,
      },
    })
    const store = usePomodoroStore()
    await store.fetchPomodoroSessions(42)
    expect(store.sessions).toHaveLength(1)
    expect(store.sessions[0].id).toBe('mock')
  })

  it('【空响应】两端字段都缺 → store.sessions 为空数组（非 undefined/null）', async () => {
    getMock.mockResolvedValue({
      success: true,
      data: { total: 0, page: 1, limit: 50 },  // 没有 sessions 也没有 pomodoros
    })
    const store = usePomodoroStore()
    await store.fetchPomodoroSessions(42)
    expect(store.sessions).toEqual([])
  })

  it('【active session 恢复】ended_at=null 的 session → store.activeSession 正确赋值', async () => {
    getMock.mockResolvedValue({
      success: true,
      data: {
        pomodoros: [
          { id: 10, started_at: '2026-07-01T10:00:00', ended_at: '2026-07-01T10:25:00', planned_minutes: 25, actual_seconds: 1500, completed: true, auto_toggled: false },
          { id: 11, started_at: '2026-07-01T11:00:00', ended_at: null, planned_minutes: 25, actual_seconds: null, completed: false, auto_toggled: false },
        ],
      },
    })
    const store = usePomodoroStore()
    await store.fetchPomodoroSessions(42)
    expect(store.activeSession).toBeTruthy()
    expect(store.activeSession.id).toBe(11)
    expect(store.activeSession.plannedMinutes).toBe(25)
  })
})
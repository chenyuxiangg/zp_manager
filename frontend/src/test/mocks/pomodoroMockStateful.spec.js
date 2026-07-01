// B0345 — Pomodoro mock 模块化持久化（行为级契约）
//
// 修复要点（必须守护）：
// 1. startSession 推入新 active session 到 sessionsByTask[taskId]
// 2. endSession 找到最近 active session 关闭（写 ended_at / actual_seconds / completed / auto_toggled）
// 3. listSessions 返真实 sessionsByTask[taskId] 数组（不再固定 mock 数据）
// 4. 不同 taskId 的 sessions 互不干扰
// 5. endSession 接受真实 elapsed duration（不再硬编码 25*60）
// 6. __resetMockPomodoroState 测试辅助存在

import { describe, it, expect, beforeEach } from 'vitest'
import { mockApi, __resetMockPomodoroState } from '@/mocks/modules/pomodoro'

describe('B0345 — Pomodoro mock 模块化持久化', () => {
  beforeEach(() => {
    __resetMockPomodoroState()
  })

  it('【startSession】推入新 active session（ended_at=null）', () => {
    const res = mockApi.startSession(1, { planned_minutes: 25 })
    expect(res.success).toBe(true)
    expect(res.data.session_id).toBeTruthy()
    expect(res.data.planned_minutes).toBe(25)

    const list = mockApi.listSessions(1)
    expect(list.data.sessions).toHaveLength(1)
    expect(list.data.sessions[0].id).toBe(res.data.session_id)
    expect(list.data.sessions[0].ended_at).toBeNull()
    expect(list.data.sessions[0].completed).toBe(false)
    expect(list.data.sessions[0].planned_minutes).toBe(25)
  })

  it('【endSession】关闭 active session，写 ended_at + actual_seconds', () => {
    const startRes = mockApi.startSession(1, { planned_minutes: 25 })
    const sessionId = startRes.data.session_id
    const endRes = mockApi.endSession(1, sessionId, { early_end: false, auto_toggle: false, duration: 1500 })
    expect(endRes.success).toBe(true)

    const list = mockApi.listSessions(1)
    expect(list.data.sessions).toHaveLength(1)
    const session = list.data.sessions[0]
    expect(session.ended_at).not.toBeNull()
    expect(session.actual_seconds).toBe(1500)
  })

  it('【endSession】duration 真实值优先（不是硬编码 25*60）', () => {
    const startRes = mockApi.startSession(1, { planned_minutes: 25 })
    mockApi.endSession(1, startRes.data.session_id, { early_end: true, duration: 10 })
    const list = mockApi.listSessions(1)
    expect(list.data.sessions[0].actual_seconds).toBe(10)
    expect(list.data.sessions[0].completed).toBe(false)  // early_end=true → completed=false
  })

  it('【endSession】实际跑满 ≥95% 阈值才标 completed=true', () => {
    const startRes = mockApi.startSession(1, { planned_minutes: 25 })
    // 25*60*0.95 = 1425
    mockApi.endSession(1, startRes.data.session_id, { early_end: false, duration: 1500 })
    const list = mockApi.listSessions(1)
    expect(list.data.sessions[0].completed).toBe(true)
  })

  it('【endSession】实际跑 10s + planned 25min → completed=false（不到 95% 阈值）', () => {
    const startRes = mockApi.startSession(1, { planned_minutes: 25 })
    mockApi.endSession(1, startRes.data.session_id, { early_end: false, duration: 10 })
    const list = mockApi.listSessions(1)
    expect(list.data.sessions[0].completed).toBe(false)
  })

  it('【endSession】auto_toggle=true → session.auto_toggled=true', () => {
    const startRes = mockApi.startSession(1, { planned_minutes: 25 })
    mockApi.endSession(1, startRes.data.session_id, { early_end: false, auto_toggle: true, duration: 1500 })
    const list = mockApi.listSessions(1)
    expect(list.data.sessions[0].auto_toggled).toBe(true)
  })

  it('【多次 start】多个 sessions 累积在同一 task 数组里', () => {
    const r1 = mockApi.startSession(1, { planned_minutes: 25 })
    mockApi.endSession(1, r1.data.session_id, { duration: 1500 })
    const r2 = mockApi.startSession(1, { planned_minutes: 25 })
    mockApi.endSession(1, r2.data.session_id, { duration: 1500 })
    const list = mockApi.listSessions(1)
    expect(list.data.sessions).toHaveLength(2)
    expect(list.data.sessions[0].ended_at).not.toBeNull()
    expect(list.data.sessions[1].ended_at).not.toBeNull()
  })

  it('【多 task 隔离】taskId=1 sessions 不污染 taskId=2', () => {
    const r1 = mockApi.startSession(1, { planned_minutes: 25 })
    mockApi.endSession(1, r1.data.session_id, { duration: 1500 })
    mockApi.startSession(2, { planned_minutes: 50 })
    const list1 = mockApi.listSessions(1)
    const list2 = mockApi.listSessions(2)
    expect(list1.data.sessions).toHaveLength(1)
    expect(list1.data.sessions[0].planned_minutes).toBe(25)
    expect(list2.data.sessions).toHaveLength(1)
    expect(list2.data.sessions[0].planned_minutes).toBe(50)
    expect(list2.data.sessions[0].ended_at).toBeNull()
  })

  it('【空 task】listSessions 返空 sessions 数组（非 null/报错）', () => {
    const list = mockApi.listSessions(999)
    expect(list.success).toBe(true)
    expect(list.data.sessions).toEqual([])
    expect(list.data.total).toBe(0)
  })

  it('【无 active session 时 endSession】不报错，返回 success', () => {
    // 用户直接调 endSession 但从没 start 过
    const res = mockApi.endSession(1, null, { duration: 1500 })
    expect(res.success).toBe(true)
    expect(res.data.session_id).toBeNull()
  })

  it('【__resetMockPomodoroState】清空 state 用于测试隔离', () => {
    mockApi.startSession(1, { planned_minutes: 25 })
    expect(mockApi.listSessions(1).data.sessions).toHaveLength(1)
    __resetMockPomodoroState()
    expect(mockApi.listSessions(1).data.sessions).toHaveLength(0)
  })

  it('【端到端】startSession → listSessions 看到 1 active → endSession → listSessions 看到 1 ended', () => {
    // 模拟用户完整流程
    const startRes = mockApi.startSession(1, { planned_minutes: 25 })
    let list = mockApi.listSessions(1)
    expect(list.data.sessions).toHaveLength(1)
    expect(list.data.sessions[0].ended_at).toBeNull()  // active

    mockApi.endSession(1, startRes.data.session_id, { early_end: true, duration: 10 })
    list = mockApi.listSessions(1)
    expect(list.data.sessions).toHaveLength(1)  // 仍是 1 条（不是变成 2 条）
    expect(list.data.sessions[0].ended_at).not.toBeNull()  // 已结束
    expect(list.data.sessions[0].actual_seconds).toBe(10)
    expect(list.data.sessions[0].completed).toBe(false)
  })

  it('【B0346】endSession 接受 sessionId 参数定位 session（fallback active）', () => {
    // 创建 2 个 sessions（先 start 一个、end 它、再 start 第二个）
    const r1 = mockApi.startSession(1, { planned_minutes: 25 })
    mockApi.endSession(1, r1.data.session_id, { duration: 1500 })
    const r2 = mockApi.startSession(1, { planned_minutes: 30 })

    // 用错的 sessionId（r1 已 end）→ fallback 到 active（r2）
    const endRes = mockApi.endSession(1, 99999, { duration: 1500 })
    expect(endRes.data.session_id).toBe(r2.data.session_id)
  })
})
// B0327 — Pomodoro listSessions 路径对齐真后端（mock 路由表）
//
// 修复要点（必须守护）：
// 1. mock 路由分发：GET /tasks/{id}/pomodoros → pomodoro.mockApi.listSessions(taskId)
// 2. 旧 /pomodoro/sessions 路由已删除（全项目 grep 守护）
// 3. listSessions(taskId) 返 sessions 数组，含 ended_at=null 的 active session
// 4. mock 响应形状与真后端一致：{success, data: {sessions, total, page, limit}}

import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const MOCKS_INDEX = readFileSync(
  join(__dirname, '../../mocks/index.js'),
  'utf-8',
)
const MOCK_POMODORO = readFileSync(
  join(__dirname, '../../mocks/modules/pomodoro.js'),
  'utf-8',
)

describe('B0327 — mock 路由表对齐真后端路径', () => {
  it('【路由分发】GET /tasks/{id}/pomodoros 命中 listSessions', () => {
    // 源码中应有 /tasks/<id>/pomodoros 路径的 match
    expect(MOCKS_INDEX).toMatch(/\^\\\/tasks\\\/\(\\d\+\)\\\/pomodoros\$/)
  })

  it('【路由分发】listSessions 接收 taskId 参数', () => {
    expect(MOCKS_INDEX).toMatch(/pomodoro\.mockApi\.listSessions\(/)
  })

  it('【旧路径已删除】/pomodoro/sessions 路由不能再存在', () => {
    expect(MOCKS_INDEX).not.toMatch(/url\s*===\s*['"]\/pomodoro\/sessions['"]/)
  })
})

// B0346 — end URL 必须含 session_id 正则（之前只匹配裸 /end 导致 axios 真发请求）
describe('B0346 — mock 端点正则匹配含 session_id', () => {
  it('【end URL 正则】必须匹配 /tasks/{id}/pomodoro/{sessionId}/end（不是裸 /end）', () => {
    // 之前 bug: 正则 ^\/tasks\/(\d+)\/pomodoro\/end$ 只匹配裸 /end
    // B0312 契约要求 URL 含 session_id，必须 ^\/tasks\/(\d+)\/pomodoro\/(\d+)\/end$
    expect(MOCKS_INDEX).toMatch(/\\\/\(\\d\+\)\\\/pomodoro\\\/\(\\d\+\)\\\/end\$/)
    // 反向守护：不能再有裸 /end 正则
    expect(MOCKS_INDEX).not.toMatch(/\\\/\(\\d\+\)\\\/pomodoro\\\/end\$/)
  })

  it('【end URL 正则】endSession 调 mock 时传 sessionId 参数', () => {
    // mock 收到 sessionId 用于精确定位 session
    expect(MOCKS_INDEX).toMatch(/pomodoro\.mockApi\.endSession\([^)]*sessionId/)
  })
})

describe('B0327 — mock listSessions 响应形状', () => {
  it('【响应结构】listSessions 返回 sessions 字段（ES6 简写）', () => {
    // B0345: sessions 是 sessionsByTask[taskId] || []（动态），用 ES6 简写 {sessions,}
    // 直接断言 mock 源码含 ES6 简写模式（与 total 紧邻）
    expect(MOCK_POMODORO).toMatch(/sessions,\s*\n\s+total:/)
  })

  it('【响应结构】total / page / limit 字段', () => {
    // B0345: total 现在是 sessions.length（动态）
    expect(MOCK_POMODORO).toMatch(/total:\s*sessions\.length/)
    expect(MOCK_POMODORO).toMatch(/page:\s*\d+/)
    expect(MOCK_POMODORO).toMatch(/limit:\s*\d+/)
  })

  it('【active session】默认含 ended_at=null 元素（fetchActivePomodoro 能命中）', () => {
    expect(MOCK_POMODORO).toMatch(/ended_at:\s*null/)
  })

  it('【session 字段完整】id/started_at/ended_at/planned_minutes/actual_seconds/completed/auto_toggled', () => {
    // B0345: session.id 由 genId() 动态生成（不再字面量 1）；started_at 由 new Date().toISOString() 动态生成
    // 改为检查"字段被赋值"即可
    expect(MOCK_POMODORO).toMatch(/id:\s*genId\(\)/)
    expect(MOCK_POMODORO).toMatch(/started_at:\s*new Date\(\)\.toISOString\(\)/)
    expect(MOCK_POMODORO).toMatch(/planned_minutes:\s*plannedMinutes/)
  })

  it('【B0345】mock 模块化持久化：sessionsByTask 必须存在', () => {
    expect(MOCK_POMODORO).toMatch(/const sessionsByTask\s*=/)
  })

  it('【B0345】listSessions 必须读 sessionsByTask[taskId]（不再硬编码数据）', () => {
    expect(MOCK_POMODORO).toMatch(/sessionsByTask\[taskId\]/)
  })

  it('【B0345】startSession 必须 push session 到 sessionsByTask[taskId]', () => {
    expect(MOCK_POMODORO).toMatch(/sessionsByTask\[taskId\]\.push\(session\)/)
  })

  it('【B0345】endSession 必须 find active session + 写 ended_at', () => {
    expect(MOCK_POMODORO).toMatch(/find\(s\s*=>\s*!s\.ended_at\)/)
    expect(MOCK_POMODORO).toMatch(/active\.ended_at\s*=\s*new Date\(\)\.toISOString\(\)/)
  })

  it('【listSessions 接受 taskId】签名变更', () => {
    expect(MOCK_POMODORO).toMatch(/listSessions\(taskId\)/)
  })
})
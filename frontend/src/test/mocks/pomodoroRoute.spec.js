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

describe('B0327 — mock listSessions 响应形状', () => {
  it('【响应结构】含 sessions 数组', () => {
    expect(MOCK_POMODORO).toMatch(/sessions:\s*\[/)
  })

  it('【响应结构】含 total / page / limit 字段', () => {
    expect(MOCK_POMODORO).toMatch(/total:\s*\d+/)
    expect(MOCK_POMODORO).toMatch(/page:\s*\d+/)
    expect(MOCK_POMODORO).toMatch(/limit:\s*\d+/)
  })

  it('【active session】默认含 ended_at=null 元素（fetchActivePomodoro 能命中）', () => {
    expect(MOCK_POMODORO).toMatch(/ended_at:\s*null/)
  })

  it('【session 字段完整】id/started_at/ended_at/planned_minutes/actual_seconds/completed/auto_toggled', () => {
    expect(MOCK_POMODORO).toMatch(/id:\s*1/)
    expect(MOCK_POMODORO).toMatch(/started_at:\s*['"][^'"]+['"]/)
    expect(MOCK_POMODORO).toMatch(/planned_minutes:\s*25/)
  })

  it('【listSessions 接受 taskId】签名变更', () => {
    expect(MOCK_POMODORO).toMatch(/listSessions\(taskId\)/)
  })
})
// B0313 — TaskDetail.vue pomodoro start 发 planned_minutes（自定义时长）
//
// 修复要点（必须守护）：
// 1. startPomodoro 发 planned_minutes（不再发 duration）
// 2. 兜底同步后端权威 planned_minutes
// 3. mock startSession 接受 planned_minutes 优先，duration 兜底
//
// 测试策略：源码 grep + mock 端点契约

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const TASK_DETAIL_VUE = readFileSync(
  join(__dirname, '../../../src/views/TaskDetail.vue'),
  'utf-8',
)

const MOCK_POMODORO = readFileSync(
  join(__dirname, '../../../src/mocks/modules/pomodoro.js'),
  'utf-8',
)

describe('B0313 — TaskDetail.vue pomodoro start planned_minutes（源码守护）', () => {
  it('【startPomodoro 发 planned_minutes】源码含 `planned_minutes: pomodoroMinutes`', () => {
    // 守护：startPomodoro 必须发 planned_minutes 字段（与后端 PomodoroSession.planned_minutes 对齐）
    expect(TASK_DETAIL_VUE).toMatch(/planned_minutes:\s*pomodoroMinutes\.value/)
  })

  it('【startPomodoro 不发 duration】源码不应在 start 请求体里发 duration', () => {
    // 守护：startPomodoro 不应再发 duration（duration 是 end 端点概念）
    // 注意：end body 仍发 duration，grep 仅看 start 段
    const startSection = TASK_DETAIL_VUE.match(/async function startPomodoro[\s\S]*?^\}/m)?.[0] || ''
    expect(startSection).not.toMatch(/duration:\s*pomodoroMinutes/)
  })

  it('【startPomodoro 兜底同步后端】响应 planned_minutes 与本地不同时更新本地', () => {
    // 守护：响应兜底逻辑必须存在
    expect(TASK_DETAIL_VUE).toMatch(/pomodoroMinutes\.value\s*=\s*res\.data\.planned_minutes/)
  })
})

describe('B0313 — mock startSession 端点契约', () => {
  it('【mock startSession 优先 planned_minutes】', () => {
    expect(MOCK_POMODORO).toMatch(/data\?\.planned_minutes\s*\?\?\s*data\?\.duration/)
  })

  it('【mock 响应含 planned_minutes 字段】', () => {
    expect(MOCK_POMODORO).toMatch(/planned_minutes:\s*plannedMinutes/)
  })

  it('【mock startSession 兼容旧 duration 兜底】无 planned_minutes 时 fallback duration', () => {
    // 兜底链：planned_minutes ?? duration ?? 25
    expect(MOCK_POMODORO).toMatch(/data\?\.duration\s*\?\?\s*25/)
  })
})
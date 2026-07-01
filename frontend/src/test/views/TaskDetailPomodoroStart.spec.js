// B0313 — Pomodoro start 发 planned_minutes（自定义时长）
// B0342 — API 调用已从 TaskDetail.vue 迁出到 stores/pomodoro.js
//
// 修复要点（必须守护）：
// 1. stores/pomodoro.js startPomodoro 发 planned_minutes（不再发 duration）
// 2. TaskDetail.vue 把本地 pomodoroMinutes.value 透传给 store action
// 3. TaskDetail.vue 响应兜底同步后端权威 planned_minutes
// 4. mock startSession 接受 planned_minutes 优先，duration 兜底
//
// 测试策略：源码 grep + mock 端点契约

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const TASK_DETAIL_VUE = readFileSync(
  join(__dirname, '../../../src/views/TaskDetail.vue'),
  'utf-8',
)

const POMODORO_STORE = readFileSync(
  join(__dirname, '../../../src/stores/pomodoro.js'),
  'utf-8',
)

const MOCK_POMODORO = readFileSync(
  join(__dirname, '../../../src/mocks/modules/pomodoro.js'),
  'utf-8',
)

describe('B0342 — pomodoro start 链路源码守护', () => {
  it('【stores/pomodoro.js startPomodoro 发 planned_minutes】', () => {
    // 守护：store action 必须发 planned_minutes 字段（与后端 PomodoroSession.planned_minutes 对齐）
    expect(POMODORO_STORE).toMatch(/planned_minutes:\s*plannedMinutes/)
  })

  it('【stores/pomodoro.js startPomodoro 不发 duration】', () => {
    // 守护：start action 不应再发 duration（duration 是 end 端点概念）
    // 切分 start action：从 "async startPomodoro" 到下一个 "async " 函数起始之前
    const startSection = POMODORO_STORE.match(/async startPomodoro[\s\S]*?(?=async \w+)/)?.[0] || ''
    expect(startSection).not.toMatch(/duration:\s*\w+/)
  })

  it('【TaskDetail.vue 调用 store 时透传 pomodoroMinutes.value】', () => {
    // 守护：组件本地分钟数必须传到 store action（避免硬编码 25）
    expect(TASK_DETAIL_VUE).toMatch(/pomodoroStore\.startPomodoro\(\s*taskId,\s*pomodoroMinutes\.value\s*\)/)
  })

  it('【TaskDetail.vue 兜底同步后端 planned_minutes】', () => {
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
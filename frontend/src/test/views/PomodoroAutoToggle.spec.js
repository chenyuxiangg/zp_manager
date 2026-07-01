// B0325 — Pomodoro end body auto_toggle / early_end 契约测试
//
// 守护：
// 1. stopPomodoro body 必传 early_end / auto_toggle
// 2. pomodoroAutoToggle 默认 false (PR0021 纯计时)
// 3. onPomodoroComplete 不调 API（只切 UI 状态）
// 4. 源码 grep：stopPomodoro body 包含 3 字段

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const TASK_DETAIL_VUE = readFileSync(
  join(__dirname, '../../../src/views/TaskDetail.vue'),
  'utf-8',
)

describe('B0325 — Pomodoro end body auto_toggle / early_end（源码守护）', () => {
  it('【stopPomodoro body 必含 early_end】', () => {
    expect(TASK_DETAIL_VUE).toMatch(/early_end:\s*earlyEnd/)
  })

  it('【stopPomodoro body 必含 auto_toggle】', () => {
    expect(TASK_DETAIL_VUE).toMatch(/auto_toggle:\s*pomodoroAutoToggle\.value/)
  })

  it('【stopPomodoro body duration 用真实 elapsed】B0345', () => {
    // B0345 修复：duration 必须是真实 elapsed 秒数（不是计划时长）
    // 之前传 pomodoroMinutes.value * 60 导致 actual_seconds 永远记录计划时长
    expect(TASK_DETAIL_VUE).toMatch(/duration:\s*elapsedSec/)
    // 反向守护：禁止再传 pomodoroMinutes * 60（计划时长）作为 duration
    expect(TASK_DETAIL_VUE).not.toMatch(/duration:\s*pomodoroMinutes\.value\s*\*\s*60/)
  })

  it('【pomodoroAutoToggle ref 默认 false】PR0021 纯计时契约', () => {
    expect(TASK_DETAIL_VUE).toMatch(/const pomodoroAutoToggle\s*=\s*ref\(false\)/)
  })

  it('【onPomodoroComplete 不调 API】只切 UI 状态', () => {
    // 守护：onPomodoroComplete 内部不应有 api.post
    const match = TASK_DETAIL_VUE.match(/async function onPomodoroComplete[\s\S]*?\n\}/)
    expect(match).not.toBeNull()
    expect(match[0]).not.toMatch(/api\.post/)
  })

  it('【onPomodoroComplete UI 反馈含 auto_toggle 提示文案】', () => {
    // 倒计时归零 + auto_toggle=true 时显示"任务已自动完成"
    const match = TASK_DETAIL_VUE.match(/async function onPomodoroComplete[\s\S]*?\n\}/)
    expect(match).not.toBeNull()
    expect(match[0]).toMatch(/任务已自动完成/)
  })

  it('【stopPomodoro signature 接受 earlyEnd 参数】', () => {
    expect(TASK_DETAIL_VUE).toMatch(/async function stopPomodoro\(earlyEnd\s*=\s*false\)/)
  })
})

// mock 端点契约：B0325 同步 mocks/modules/pomodoro.js 接受新字段
import { describe as desc2, it as it2, expect as exp2 } from 'vitest'
import { mockApi } from '@/mocks/modules/pomodoro'

desc2('B0325 — pomodoro mock 接受 early_end / auto_toggle', () => {
  it2('endSession 接受 early_end / auto_toggle 字段并回传 completed / auto_toggled', () => {
    // B0346 修复：endSession 签名加 sessionId 参数（前端发 /tasks/{id}/pomodoro/{sessionId}/end）
    const startRes = mockApi.startSession(1, { planned_minutes: 25 })
    const res = mockApi.endSession(1, startRes.data.session_id, {
      early_end: false,
      auto_toggle: true,
      duration: 1500,
    })
    exp2(res.success).toBe(true)
    exp2(res.data.early_end).toBe(false)
    exp2(res.data.auto_toggle).toBe(true)
  })
})
// B0314 — PomodoroHistoryList.vue 字段名修复契约守护
// 目标：源码 grep 守护 + 行为测试字段映射
// 守护范围：
//   1) 源码 grep（反向）：PomodoroHistoryList.vue 不含 duration_minutes 字符串
//   2) 源码 grep（正向）：PomodoroHistoryList.vue 含 actual_seconds 和 planned_minutes 字段访问
//   3) 行为测试 — 已完成 session: actual_seconds=1500 → "25 分钟"
//   4) 行为测试 — 未完成 session: actual_seconds=null + planned_minutes=25 → "25 分钟（计划）"
//   5) 行为测试 — 字段都缺 → "—"
//   6) 行为测试 — 空列表 → "暂无专注记录"

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'fs'
import { join } from 'path'

const componentSource = readFileSync(
  join(__dirname, '../../../components/pomodoro/PomodoroHistoryList.vue'),
  'utf-8'
)

// ============ 1. 源码 grep 守护 ============
describe('B0314 源码 grep - PomodoroHistoryList.vue 字段名', () => {
  it('【反向】不包含 duration_minutes 字段', () => {
    expect(componentSource).not.toMatch(/duration_minutes/)
  })

  it('【正向】含 actual_seconds 字段访问', () => {
    expect(componentSource).toMatch(/actual_seconds/)
  })

  it('【正向】含 planned_minutes 字段访问', () => {
    expect(componentSource).toMatch(/planned_minutes/)
  })

  it('含 formatDuration 函数定义', () => {
    expect(componentSource).toMatch(/function\s+formatDuration\s*\(/)
  })
})

// ============ 2. 行为测试 ============
describe('B0314 PomodoroHistoryList 字段映射行为', () => {
  it('【已完成 session】actual_seconds=1500 → 显示 "25 分钟"', async () => {
    const { default: PomodoroHistoryList } = await import('@/components/pomodoro/PomodoroHistoryList.vue')
    const w = mount(PomodoroHistoryList, {
      props: {
        sessions: [
          { id: 1, started_at: '2026-06-21T10:00:00Z', actual_seconds: 1500, planned_minutes: 25, completed: true },
        ],
      },
    })
    expect(w.find('.pomodoro-history__duration').text()).toBe('25 分钟')
  })

  it('【未完成 session】actual_seconds=null + planned_minutes=25 → "25 分钟（计划）"', async () => {
    const { default: PomodoroHistoryList } = await import('@/components/pomodoro/PomodoroHistoryList.vue')
    const w = mount(PomodoroHistoryList, {
      props: {
        sessions: [
          { id: 2, started_at: '2026-06-21T10:00:00Z', actual_seconds: null, planned_minutes: 25, completed: false },
        ],
      },
    })
    expect(w.find('.pomodoro-history__duration').text()).toBe('25 分钟（计划）')
  })

  it('【字段都缺】空对象 session → 显示 "—"', async () => {
    const { default: PomodoroHistoryList } = await import('@/components/pomodoro/PomodoroHistoryList.vue')
    const w = mount(PomodoroHistoryList, {
      props: {
        sessions: [
          { id: 3, started_at: '2026-06-21T10:00:00Z', completed: false },
        ],
      },
    })
    expect(w.find('.pomodoro-history__duration').text()).toBe('—')
  })

  it('【空列表】sessions=[] → 显示 "暂无专注记录"', async () => {
    const { default: PomodoroHistoryList } = await import('@/components/pomodoro/PomodoroHistoryList.vue')
    const w = mount(PomodoroHistoryList, { props: { sessions: [] } })
    expect(w.text()).toContain('暂无专注记录')
  })
})
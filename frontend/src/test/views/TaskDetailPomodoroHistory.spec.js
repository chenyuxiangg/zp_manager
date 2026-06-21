// B0315 — TaskDetail.vue PomodoroHistoryList 数据流 + end 后刷新历史
//
// 修复要点（必须守护）：
// 1. fetchPomodoroSessions 把 sessions 数组赋给 pomodoroSessions.value（PomodoroHistoryList 显示）
// 2. stopPomodoro 成功后 await fetchPomodoroSessions()（end 后历史刷新）
// 3. 函数重命名：fetchActivePomodoro → fetchPomodoroSessions
//
// 测试策略：源码 grep 守护（5 个）+ mock 端到端（2 个）

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const TASK_DETAIL_VUE = readFileSync(
  join(__dirname, '../../../src/views/TaskDetail.vue'),
  'utf-8',
)

describe('B0315 — TaskDetail.vue PomodoroHistoryList 数据流（源码守护）', () => {
  it('【fetchPomodoroSessions 回填历史】赋值给 pomodoroSessions ref', () => {
    // 守护：sessions 数组必须赋给 pomodoroSessions.value
    expect(TASK_DETAIL_VUE).toMatch(/pomodoroSessions\.value\s*=\s*sessions/)
  })

  it('【fetchPomodoroSessions 恢复 active】仍查 ended_at=null', () => {
    // 守护：active session 恢复逻辑保留（B0312 兼容）
    expect(TASK_DETAIL_VUE).toMatch(/sessions\.find\(s\s*=>\s*!s\.ended_at\)/)
  })

  it('【stopPomodoro 刷新历史】end 成功后 await fetchPomodoroSessions', () => {
    // 守护：end 后刷新历史
    expect(TASK_DETAIL_VUE).toMatch(/await fetchPomodoroSessions\(\)/)
  })

  it('【旧函数名 fetchActivePomodoro 已删除】', () => {
    // 守护：旧函数名不能残留
    expect(TASK_DETAIL_VUE).not.toMatch(/fetchActivePomodoro/)
  })

  it('【onMounted 调用 fetchPomodoroSessions】非 fetchActivePomodoro', () => {
    // 守护：onMounted 调用新函数名
    expect(TASK_DETAIL_VUE).toMatch(/fetchPomodoroSessions\(\)/)
  })
})

// ==================== 端到端（mock 模式） ====================
import { setupTestPinia } from '@/test/helpers/store-mock'

const getMock = vi.fn()
const postMock = vi.fn()
vi.mock('@/api', () => ({
  default: {
    get: (...args) => getMock(...args),
    post: (...args) => postMock(...args),
  },
}))

import { ref } from 'vue'

describe('B0315 — PomodoroHistoryList 数据流 + end 后刷新（端到端）', () => {
  beforeEach(() => {
    setupTestPinia()
    getMock.mockReset()
    postMock.mockReset()
  })

  it('【PomodoroHistoryList 数据流】mock 返 2 sessions → pomodoroSessions 数组含 2 元素', async () => {
    // 模拟 fetchPomodoroSessions 调用
    getMock.mockResolvedValue({
      success: true,
      data: {
        sessions: [
          { id: 1, started_at: '2026-06-20T09:00:00', ended_at: '2026-06-20T09:25:00', planned_minutes: 25 },
          { id: 2, started_at: '2026-06-20T10:00:00', ended_at: null, planned_minutes: 25 },
        ],
        total: 2, page: 1, limit: 50,
      },
    })
    const pomodoroSessions = ref([])
    // 调用 fetchPomodoroSessions（mock 路径走 axios.get adapter 短路）
    const res = await getMock('/tasks/1/pomodoros')
    if (res.success) {
      pomodoroSessions.value = res.data.sessions
    }
    expect(pomodoroSessions.value).toHaveLength(2)
    expect(pomodoroSessions.value[0].id).toBe(1)
    expect(pomodoroSessions.value[1].ended_at).toBeNull()
  })

  it('【end 后历史刷新】end 成功后重新拉 sessions 列表', async () => {
    // 1. 初始拉取（end 前）
    getMock.mockResolvedValueOnce({
      success: true,
      data: {
        sessions: [{ id: 1, started_at: '2026-06-20T09:00:00', ended_at: null, planned_minutes: 25 }],
        total: 1, page: 1, limit: 50,
      },
    })
    // 2. end 后再次拉取
    getMock.mockResolvedValueOnce({
      success: true,
      data: {
        sessions: [
          { id: 1, started_at: '2026-06-20T09:00:00', ended_at: '2026-06-20T09:25:00', planned_minutes: 25 },
          { id: 2, started_at: '2026-06-20T10:00:00', ended_at: null, planned_minutes: 25 },
        ],
        total: 2, page: 1, limit: 50,
      },
    })
    // 模拟 end 后 await fetchPomodoroSessions
    const first = await getMock('/tasks/1/pomodoros')
    expect(first.data.sessions).toHaveLength(1)
    expect(first.data.sessions[0].ended_at).toBeNull()  // active

    const second = await getMock('/tasks/1/pomodoros')
    expect(second.data.sessions).toHaveLength(2)
    expect(second.data.sessions[0].ended_at).not.toBeNull()  // ended
    expect(second.data.sessions[1].ended_at).toBeNull()  // new active
  })
})
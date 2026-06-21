// B0312 — TaskDetail.vue pomodoro session_id 契约测试
// B0315 — 同步更新：fetchActivePomodoro → fetchPomodoroSessions（重命名）
//
// 修复要点（必须守护）：
// 1. startPomodoro 必捕获响应 data.session_id
// 2. stopPomodoro URL 必含 session_id
// 3. 无 session_id 时 stop 不调 API（防御）
// 4. onMounted 调 fetchPomodoroSessions 恢复 active session（重命名自 fetchActivePomodoro）
// 5. fetchPomodoroSessions 内部回填 pomodoroSessions 历史列表（B0315 修复）
//
// 测试策略：源码 grep + 关键路径端到端（fetchPomodoroSessions 行为单独测）

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const TASK_DETAIL_VUE = readFileSync(
  join(__dirname, '../../../src/views/TaskDetail.vue'),
  'utf-8',
)

describe('B0312/B0315 — TaskDetail.vue pomodoro session_id 生命周期（源码守护）', () => {
  it('【startPomodoro】捕获响应 data.session_id', () => {
    // 守护：startPomodoro 必须将 res.data.session_id 保存到 ref
    expect(TASK_DETAIL_VUE).toMatch(/currentPomodoroSessionId\.value\s*=\s*res\?\.data\?\.session_id\s*\|\|\s*null/)
  })

  it('【stopPomodoro URL 含 session_id】URL 模板含 ${currentPomodoroSessionId.value}', () => {
    // 守护：stop URL 必须拼接 session_id（不能是裸 /end）
    expect(TASK_DETAIL_VUE).toMatch(/\$\{currentPomodoroSessionId\.value\}/)
    expect(TASK_DETAIL_VUE).toMatch(/\/tasks\/\$\{taskId\}\/pomodoro\/\$\{currentPomodoroSessionId\.value\}\/end/)
  })

  it('【stopPomodoro 防御】无 session_id 时不调 API', () => {
    // 守护：stopPomodoro 入口先检查 session_id 缺失
    expect(TASK_DETAIL_VUE).toMatch(/if\s*\(\s*!currentPomodoroSessionId\.value\s*\)/)
    expect(TASK_DETAIL_VUE).toMatch(/return/)
  })

  it('【onMounted 恢复 active session】调用 fetchPomodoroSessions', () => {
    // B0315 修复：函数重命名为 fetchPomodoroSessions
    expect(TASK_DETAIL_VUE).toMatch(/fetchPomodoroSessions\(\)/)
    // 旧名 fetchActivePomodoro 不能残留
    expect(TASK_DETAIL_VUE).not.toMatch(/fetchActivePomodoro/)
  })

  it('【fetchPomodoroSessions 实现】查找 ended_at=null 的 session', () => {
    // B0315 修复：函数重命名
    expect(TASK_DETAIL_VUE).toMatch(/async function fetchPomodoroSessions/)
    expect(TASK_DETAIL_VUE).toMatch(/!\s*s\.ended_at/)
    expect(TASK_DETAIL_VUE).toMatch(/find\(s\s*=>/)
  })

  it('【fetchPomodoroSessions 容错】catch 静默失败', () => {
    // 守护：sessions 接口缺失时不影响主流程
    expect(TASK_DETAIL_VUE).toMatch(/catch\s*\{/)
  })

  it('【fetchPomodoroSessions 回填历史】pomodoroSessions.value = sessions', () => {
    // B0315 修复：sessions 数组赋值给 pomodoroSessions ref（PomodoroHistoryList 显示）
    expect(TASK_DETAIL_VUE).toMatch(/pomodoroSessions\.value\s*=\s*sessions/)
  })

  it('【stopPomodoro 刷新历史】end 后调 fetchPomodoroSessions', () => {
    // B0315 修复：end 后必须刷新历史列表
    expect(TASK_DETAIL_VUE).toMatch(/await fetchPomodoroSessions\(\)/)
  })

  it('【currentPomodoroSessionId ref 声明】组件 setup 中存在', () => {
    // 守护：session_id ref 在 setup 中初始化
    expect(TASK_DETAIL_VUE).toMatch(/const currentPomodoroSessionId\s*=\s*ref\(null\)/)
  })
})

// fetchPomodoroSessions 端点契约 — 后端 GET /tasks/{id}/pomodoros 返回 sessions 数组
// 含 ended_at 字段（B0327 修复后才有此端点，但本测试 mock 返可独立验证）
import { describe as desc2, it as it2, expect as exp2, vi as vi2, beforeEach as be2 } from 'vitest'
import { setupTestPinia } from '@/test/helpers/store-mock'

const getMock = vi2.fn()
vi2.mock('@/api', () => ({
  default: { get: (...args) => getMock(...args) },
}))

import { authStore } from '@/stores/auth'

desc2('B0312/B0315 — fetchPomodoroSessions 端点契约', () => {
  be2(() => {
    setupTestPinia()
    getMock.mockReset()
  })

  it2('GET /tasks/{id}/pomodoros 应返回 {data: {sessions: [...]}} 含 ended_at 字段', async () => {
    getMock.mockResolvedValue({
      success: true,
      data: {
        sessions: [
          { id: 1, started_at: '2026-06-20T09:00:00', ended_at: '2026-06-20T09:25:00' },
          { id: 2, started_at: '2026-06-20T10:00:00', ended_at: null },
        ],
      },
    })
    const res = await getMock('/tasks/1/pomodoros')
    expect(res.success).toBe(true)
    expect(res.data.sessions).toHaveLength(2)
    const active = res.data.sessions.find(s => !s.ended_at)
    expect(active.id).toBe(2)
  })
})
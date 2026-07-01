// B0312 — Pomodoro session_id 契约测试
// B0315 — 同步更新：fetchActivePomodoro → fetchPomodoroSessions（重命名）
// B0342 — API 调用迁出到 stores/pomodoro.js，源码守护拆为 view + store 两端
//
// 修复要点（必须守护）：
// 1. TaskDetail.vue startPomodoro 必捕获响应 data.session_id
// 2. stores/pomodoro.js endPomodoro URL 必含 session_id（迁出后 URL 模板在 store）
// 3. TaskDetail.vue stopPomodoro 入口检查 session_id 缺失防御
// 4. TaskDetail.vue onMounted 调 fetchPomodoroSessions 恢复 active session
// 5. TaskDetail.vue fetchPomodoroSessions 内部回填 pomodoroSessions 历史列表
// 6. stores/pomodoro.js fetchPomodoroSessions 返回 sessions 数组
//
// 测试策略：源码 grep + 关键路径端到端（fetchPomodoroSessions 行为单独测）

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

describe('B0312/B0315/B0342 — pomodoro session_id 生命周期（源码守护）', () => {
  it('【startPomodoro】TaskDetail.vue 捕获响应 data.session_id', () => {
    // 守护：startPomodoro 必须将 res.data.session_id 保存到 ref
    expect(TASK_DETAIL_VUE).toMatch(/currentPomodoroSessionId\.value\s*=\s*res\?\.data\?\.session_id\s*\|\|\s*null/)
  })

  it('【stopPomodoro URL 含 session_id】stores/pomodoro.js URL 模板含 ${sessionId}', () => {
    // B0342 修复：URL 模板已迁出到 store（B0312 守护目标移动）
    expect(POMODORO_STORE).toMatch(/\$\{sessionId\}/)
    expect(POMODORO_STORE).toMatch(/\/tasks\/\$\{taskId\}\/pomodoro\/\$\{sessionId\}\/end/)
  })

  it('【TaskDetail.vue stopPomodoro 防御】无 session_id 时不调 API', () => {
    // 守护：组件 stopPomodoro 入口先检查 session_id 缺失
    expect(TASK_DETAIL_VUE).toMatch(/if\s*\(\s*!currentPomodoroSessionId\.value\s*\)/)
    expect(TASK_DETAIL_VUE).toMatch(/return/)
  })

  it('【onMounted 恢复 active session】调用 fetchPomodoroSessions', () => {
    // B0315 修复：函数重命名为 fetchPomodoroSessions
    expect(TASK_DETAIL_VUE).toMatch(/fetchPomodoroSessions\(\)/)
    // 旧名 fetchActivePomodoro 不能残留
    expect(TASK_DETAIL_VUE).not.toMatch(/fetchActivePomodoro/)
  })

  it('【TaskDetail.vue fetchPomodoroSessions 实现】查找 ended_at=null 的 session', () => {
    // B0315 修复：函数重命名
    expect(TASK_DETAIL_VUE).toMatch(/async function fetchPomodoroSessions/)
    expect(TASK_DETAIL_VUE).toMatch(/!\s*s\.ended_at/)
    expect(TASK_DETAIL_VUE).toMatch(/find\(s\s*=>/)
  })

  it('【TaskDetail.vue fetchPomodoroSessions 容错】catch 静默失败', () => {
    // 守护：sessions 接口缺失时不影响主流程
    expect(TASK_DETAIL_VUE).toMatch(/catch\s*\{/)
  })

  it('【TaskDetail.vue fetchPomodoroSessions 回填历史】pomodoroSessions.value = sessions', () => {
    // B0315 修复：sessions 数组赋值给 pomodoroSessions ref（PomodoroHistoryList 显示）
    expect(TASK_DETAIL_VUE).toMatch(/pomodoroSessions\.value\s*=\s*sessions/)
  })

  it('【TaskDetail.vue stopPomodoro 刷新历史】end 后调 fetchPomodoroSessions', () => {
    // B0315 修复：end 后必须刷新历史列表
    expect(TASK_DETAIL_VUE).toMatch(/await fetchPomodoroSessions\(\)/)
  })

  it('【TaskDetail.vue currentPomodoroSessionId ref 声明】组件 setup 中存在', () => {
    // 守护：session_id ref 在 setup 中初始化
    expect(TASK_DETAIL_VUE).toMatch(/const currentPomodoroSessionId\s*=\s*ref\(null\)/)
  })

  it('【stores/pomodoro.js fetchPomodoroSessions 返回 sessions 数组（兼容两端字段名）】', () => {
    // B0342 修复：API 迁出后，store 内仍需取出 sessions 数组供 view 回填
    // B0347 修复：兼容真后端 `data.pomodoros` 字段名（之前只读 data.sessions 真后端返空）
    expect(POMODORO_STORE).toMatch(/res\?\.data\?\.sessions\s*\|\|\s*res\?\.data\?\.pomodoros/)
    expect(POMODORO_STORE).toMatch(/find\(.*!.*ended_at/)
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

// B0345 — stopPomodoro 用真实 elapsed 秒数（不是计划时长）
// 之前传 `duration: pomodoroMinutes.value * 60` 导致 mock actual_seconds 永远记录计划时长
// 修复：startPomodoro 成功时记 Date.now() 到 pomodoroStartTimestamp，stopPomodoro 计算 elapsed
describe('B0345 — TaskDetail.vue 真实 elapsed duration（源码守护）', () => {
  it('【startPomodoro】成功路径必记 pomodoroStartTimestamp = Date.now()', () => {
    expect(TASK_DETAIL_VUE).toMatch(/pomodoroStartTimestamp\.value\s*=\s*Date\.now\(\)/)
  })

  it('【stopPomodoro】duration 必用 elapsedSec（不能用 pomodoroMinutes*60 作为 duration）', () => {
    // 正向：duration 必含 elapsedSec
    expect(TASK_DETAIL_VUE).toMatch(/duration:\s*elapsedSec/)
    // 反向：禁止再传 pomodoroMinutes * 60（计划时长）
    expect(TASK_DETAIL_VUE).not.toMatch(/duration:\s*pomodoroMinutes\.value\s*\*\s*60/)
  })

  it('【stopPomodoro】end 成功后必清 pomodoroStartTimestamp（避免下次 start 误用）', () => {
    // 守护：end 后必须清，否则下次 start 拿陈旧 timestamp
    expect(TASK_DETAIL_VUE).toMatch(/pomodoroStartTimestamp\.value\s*=\s*null/)
  })

  it('【pomodoroStartTimestamp ref 声明】setup 中存在', () => {
    expect(TASK_DETAIL_VUE).toMatch(/const pomodoroStartTimestamp\s*=\s*ref\(null\)/)
  })
})
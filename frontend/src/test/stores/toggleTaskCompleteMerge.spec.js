// B0329 — useTasksStore.toggleTaskComplete 合并模式测试
//
// 修复要点（必须守护）：
// 1. toggleTaskComplete 用 Object.assign 合并而非整体赋值
// 2. 合并后保留 currentTask 原有的 stage/plan 嵌套
// 3. currentTask=null 兜底不崩
// 4. points_delta 仍透传

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupTestPinia } from '@/test/helpers/store-mock'

const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}
const mockCommentApi = {
  getComments: vi.fn(),
  addComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}
vi.mock('@/api', () => ({
  default: mockApi,
  commentApi: mockCommentApi,
}))

describe('B0329 — toggleTaskComplete 合并模式（源码守护）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTestPinia()
  })

  it('【源码 grep】用 Object.assign 合并而非 this.currentTask = res.data.task', async () => {
    // 守护：toggleTaskComplete 内部必须用 Object.assign
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const STORES_TASKS = readFileSync(
      join(__dirname, '../../../src/stores/tasks.js'),
      'utf-8',
    )
    // toggleTaskComplete 函数体必须包含 Object.assign(this.currentTask, ...)
    const toggleFnBody = STORES_TASKS.match(/async toggleTaskComplete[\s\S]*?\n\s{4}\}/)?.[0] || ''
    expect(toggleFnBody).toMatch(/Object\.assign\(this\.currentTask,\s*res\.data\.task\)/)
  })

  it('【源码 grep 不应整体赋值】this.currentTask = res.data.task 不应出现在 toggleTaskComplete 内', async () => {
    const { readFileSync } = await import('fs')
    const { join } = await import('path')
    const STORES_TASKS = readFileSync(
      join(__dirname, '../../../src/stores/tasks.js'),
      'utf-8',
    )
    // 整体赋值（直接覆盖）只能在 currentTask=null 兜底分支出现，不能作为唯一逻辑
    // 用反义 grep：直接出现在 if(res.success && res.data?.task) 后不应该再有 this.currentTask = res.data.task
    const toggleFnBody = STORES_TASKS.match(/async toggleTaskComplete[\s\S]*?\n\s{4}\}/)?.[0] || ''
    // 找 if(this.currentTask && res.data?.task) 分支 —— 里面应该是 Object.assign 而非 =
    const mergeBranch = toggleFnBody.match(/if\s*\(this\.currentTask\s*&&\s*res\.data\?\.task\)\s*\{[\s\S]*?\}/)?.[0] || ''
    expect(mergeBranch).not.toMatch(/this\.currentTask\s*=\s*res\.data\.task/)
  })
})

describe('B0329 — toggleTaskComplete 行为：保留 stage/plan 嵌套', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTestPinia()
  })

  it('【toggle 后保留 stage/plan】currentTask 原有的嵌套字段不被 toggle 响应覆盖', async () => {
    const { useTasksStore } = await import('@/stores/tasks')
    const store = useTasksStore()

    // 1. fetchTaskDetail 设 currentTask 含 stage/plan 嵌套（与真后端 GET /tasks/:id 一致）
    store.currentTask = {
      id: 1,
      stage_id: 5,
      title: '原 title',
      description: '原 description',
      status: 'pending',
      points: 10,
      stage: { id: 5, title: '第一阶段', plan_id: 3 },
      plan: { id: 3, title: '高考冲刺计划' },
    }

    // 2. toggle 后端响应（与 routes/tasks.py:211-223 真后端契约一致 —— 不带 stage/plan 嵌套）
    mockApi.patch.mockResolvedValue({
      success: true,
      data: {
        task: {
          id: 1,
          stage_id: 5,
          title: '原 title',
          description: '原 description',
          scheduled_date: '2026-06-21',
          completed_at: '2026-06-21T10:00:00',
          points: 10,
          status: 'completed',
          // 关键：没有 stage 嵌套、没有 plan 嵌套
        },
        points_delta: 10,
      },
    })

    await store.toggleTaskComplete(1, 'manual')

    // 3. 验证：currentTask 仍保留原有的 stage/plan 嵌套
    expect(store.currentTask.stage).toEqual({ id: 5, title: '第一阶段', plan_id: 3 })
    expect(store.currentTask.plan).toEqual({ id: 3, title: '高考冲刺计划' })
    // 4. 验证：toggle 响应的新字段已合并
    expect(store.currentTask.status).toBe('completed')
    expect(store.currentTask.completed_at).toBe('2026-06-21T10:00:00')
  })

  it('【currentTask=null 兜底】首次 toggle（无 fetchTaskDetail）不崩', async () => {
    const { useTasksStore } = await import('@/stores/tasks')
    const store = useTasksStore()
    expect(store.currentTask).toBeNull()

    mockApi.patch.mockResolvedValue({
      success: true,
      data: {
        task: {
          id: 1,
          stage_id: 5,
          title: '新 task',
          status: 'completed',
          points: 10,
        },
        points_delta: 10,
      },
    })

    await store.toggleTaskComplete(1, 'manual')

    // currentTask=null 时直接赋值（不会切回 detail；无嵌套保留问题）
    expect(store.currentTask).toEqual({
      id: 1,
      stage_id: 5,
      title: '新 task',
      status: 'completed',
      points: 10,
    })
  })

  it('【points_delta 仍透传】响应 points_delta 字段行为不变', async () => {
    const { useTasksStore } = await import('@/stores/tasks')
    const store = useTasksStore()

    mockApi.patch.mockResolvedValue({
      success: true,
      data: {
        task: { id: 1, stage_id: 5, status: 'completed', points: 10, title: 't' },
        points_delta: 10,
      },
    })

    const res = await store.toggleTaskComplete(1, 'pomodoro_auto_toggle')

    expect(res.data.points_delta).toBe(10)
    expect(mockApi.patch).toHaveBeenCalledWith('/tasks/1/toggle', { source: 'pomodoro_auto_toggle' })
  })

  it('【source 默认 manual】不传 source 时 PATCH body 必含 source=manual', async () => {
    const { useTasksStore } = await import('@/stores/tasks')
    const store = useTasksStore()

    mockApi.patch.mockResolvedValue({
      success: true,
      data: { task: { id: 1, status: 'completed' }, points_delta: 10 },
    })

    await store.toggleTaskComplete(1)  // 不传 source

    // B0326 守护：source 字段必传（默认 manual）
    expect(mockApi.patch).toHaveBeenCalledWith('/tasks/1/toggle', { source: 'manual' })
  })

  it('【title/status/points 字段合并】fetchTaskDetail 后 toggle，currentTask 含 stage/plan/title/status 等合并值', async () => {
    const { useTasksStore } = await import('@/stores/tasks')
    const store = useTasksStore()

    store.currentTask = {
      id: 1,
      stage_id: 5,
      title: '原 title',
      description: '原 description',
      scheduled_date: '2026-06-20',
      status: 'pending',
      points: 10,
      stage: { id: 5, title: '第一阶段', plan_id: 3 },
      plan: { id: 3, title: '高考冲刺计划' },
    }

    mockApi.patch.mockResolvedValue({
      success: true,
      data: {
        task: {
          id: 1,
          stage_id: 5,
          title: '新 title',  // 后端允许 title 变更（理论上不会，但守卫合并行为）
          description: '新 description',
          scheduled_date: '2026-06-21',
          completed_at: '2026-06-21T10:00:00',
          points: 10,
          status: 'completed',
        },
        points_delta: 10,
      },
    })

    await store.toggleTaskComplete(1, 'manual')

    // Object.assign 会用响应字段覆盖（title/status 等同步）
    expect(store.currentTask.title).toBe('新 title')
    expect(store.currentTask.status).toBe('completed')
    expect(store.currentTask.completed_at).toBe('2026-06-21T10:00:00')
    expect(store.currentTask.scheduled_date).toBe('2026-06-21')
    // 但 stage/plan 嵌套保留（响应没这些字段）
    expect(store.currentTask.stage).toEqual({ id: 5, title: '第一阶段', plan_id: 3 })
    expect(store.currentTask.plan).toEqual({ id: 3, title: '高考冲刺计划' })
  })
})
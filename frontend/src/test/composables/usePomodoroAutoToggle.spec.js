// PR0008 — Pomodoro 联动 auto_toggle 编排
// 后端: pomodoro_sessions 表 + /tasks/:id/pomodoro/start|end 接口
//       complete=true 且 duration >= 25min 时，end 时自动 toggle 任务
// FE 行为契约:
//   - auto_toggle=true + complete=true + duration>=25min → onComplete 后调 toggleTask
//   - 任务已 completed → 不调 toggleTask (race condition)
//   - toggleTask 返 RATE_LIMITED → 静默（用 PR0003 interceptor）
//   - toggleTask 成功 → emit points_delta 触发反馈三件套

import { describe, it, expect, vi } from 'vitest'
import { usePomodoroAutoToggle } from '@/composables/usePomodoroAutoToggle'

const toggleTaskMock = vi.fn()
const endSessionMock = vi.fn()
const showFeedbackMock = vi.fn()

function makeCtx(overrides = {}) {
  return {
    task: { id: 1, status: 'pending', ...overrides.task },
    session: { duration: 25 * 60 * 1000, auto_toggle: true, ...overrides.session },
    toggleTask: toggleTaskMock,
    endSession: endSessionMock,
    onFeedback: showFeedbackMock,
    onComplete: overrides.onComplete || (async () => true),
    ...overrides,
  }
}

describe('PR0008 — usePomodoroAutoToggle 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('【完整流程】complete=true + 25min → toggleTask 成功 → 触发反馈', async () => {
    toggleTaskMock.mockResolvedValue({ points_delta: 10 })
    endSessionMock.mockResolvedValue({})
    const complete = vi.fn().mockResolvedValue(true)
    const ctx = makeCtx()
    const result = await usePomodoroAutoToggle({
      ...ctx,
      onComplete: complete,
    })
    expect(complete).toHaveBeenCalled()
    expect(toggleTaskMock).toHaveBeenCalledWith(1)
    expect(endSessionMock).toHaveBeenCalled()
    expect(showFeedbackMock).toHaveBeenCalledWith(expect.objectContaining({ delta: 10 }))
  })

  it('【race】任务已 completed → 不调 toggleTask', async () => {
    toggleTaskMock.mockResolvedValue({ points_delta: 10 })
    const complete = vi.fn().mockResolvedValue(true)
    await usePomodoroAutoToggle(makeCtx({ task: { id: 2, status: 'completed' } }))
    expect(toggleTaskMock).not.toHaveBeenCalled()
  })

  it('【短时长】duration < 25min → auto_toggle 不触发', async () => {
    toggleTaskMock.mockResolvedValue({ points_delta: 10 })
    const complete = vi.fn().mockResolvedValue(true)
    await usePomodoroAutoToggle(makeCtx({
      session: { duration: 10 * 60 * 1000, auto_toggle: true },
    }))
    expect(toggleTaskMock).not.toHaveBeenCalled()
  })

  it('【auto_toggle=false】用户关闭联动 → 不调 toggleTask', async () => {
    toggleTaskMock.mockResolvedValue({ points_delta: 10 })
    const complete = vi.fn().mockResolvedValue(true)
    await usePomodoroAutoToggle(makeCtx({
      session: { duration: 25 * 60 * 1000, auto_toggle: false },
    }))
    expect(toggleTaskMock).not.toHaveBeenCalled()
  })

  it('【RATE_LIMITED】toggle 返 RATE_LIMITED 错误 → 静默不报', async () => {
    const rateLimitErr = new Error('rate limited')
    rateLimitErr.code = 'RATE_LIMITED'
    toggleTaskMock.mockRejectedValue(rateLimitErr)
    const complete = vi.fn().mockResolvedValue(true)
    // 不应 throw
    await expect(usePomodoroAutoToggle(makeCtx())).resolves.toBeUndefined()
  })
})

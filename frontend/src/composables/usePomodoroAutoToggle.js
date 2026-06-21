// PR0008 — Pomodoro 联动 usePomodoroAutoToggle 编排
// 行为契约 (test/composables/usePomodoroAutoToggle.spec.js 守护):
//   - 25min + complete=true + auto_toggle=true + 任务未完成 → toggleTask
//   - 任务已 completed / 短时长 / auto_toggle=false → 不调 toggleTask
//   - RATE_LIMITED → 静默

import { ERROR_CODES } from '@/constants/errorCodes'

const MIN_DURATION_MS = 25 * 60 * 1000

/**
 * Pomodoro 完成 → auto_toggle 编排
 *
 * @param {Object} ctx
 * @param {Object} ctx.task - { id, status }
 * @param {Object} ctx.session - { duration, auto_toggle }
 * @param {Function} ctx.toggleTask - (taskId) => Promise<{ points_delta }>
 * @param {Function} ctx.endSession - () => Promise<void>
 * @param {Function} ctx.onComplete - (completed: boolean) => Promise<boolean>
 * @param {Function} ctx.onFeedback - ({ delta, type }) => void
 * @returns {Promise<void>}
 */
export async function usePomodoroAutoToggle(ctx) {
  const { task, session, toggleTask, endSession, onComplete, onFeedback } = ctx
  const completed = await onComplete()
  if (!completed) return

  const shouldAutoToggle =
    session.auto_toggle &&
    task.status !== 'completed' &&
    session.duration >= MIN_DURATION_MS

  if (!shouldAutoToggle) {
    await safeEndSession(endSession)
    return
  }

  try {
    const result = await toggleTask(task.id)
    const delta = result?.points_delta || 0
    onFeedback?.({ delta, type: delta >= 0 ? 'gain' : 'spend' })
  } catch (err) {
    if (err?.code !== ERROR_CODES.RATE_LIMITED) {
      await safeEndSession(endSession)
      throw err
    }
    // RATE_LIMITED 静默
  } finally {
    await safeEndSession(endSession)
  }
}

async function safeEndSession(fn) {
  if (typeof fn !== 'function') return
  try { await fn() } catch { /* ignore */ }
}

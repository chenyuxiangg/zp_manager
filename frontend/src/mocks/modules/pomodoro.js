// B0310 — Pomodoro mock 模块
// B0325: endSession 接受 early_end / auto_toggle 字段并回传
// B0313: startSession 接受 planned_minutes 字段（duration 兜底）
// B0345: 模块化持久化 sessions（之前 listSessions 永远返回同一份固定 active session，导致
//   用户 startSession → endSession 后 PomodoroHistoryList 看不到刚才结束的记录，
//   且 fetchPomodoroSessions 把 pomodoroRunning 错误地恢复回 true）

// 模块级 in-memory state：taskId → sessions[]
// SPA 整个生命周期内保持；刷新页面会重置（mock 模式固有行为，可接受）
const sessionsByTask = {}

function genId() {
  // 简单自增 ID（避免 Date.now 在同一毫秒冲突）
  return Date.now() + Math.floor(Math.random() * 1000)
}

export const mockApi = {
  startSession(taskId, data) {
    // B0313: 优先读 planned_minutes（与真后端对齐），duration 兜底兼容旧调用
    const plannedMinutes = data?.planned_minutes ?? data?.duration ?? 25
    const session = {
      id: genId(),
      task_id: taskId,
      started_at: new Date().toISOString(),
      ended_at: null,
      planned_minutes: plannedMinutes,
      actual_seconds: null,
      completed: false,
      auto_toggled: false,
    }
    if (!sessionsByTask[taskId]) sessionsByTask[taskId] = []
    sessionsByTask[taskId].push(session)
    return {
      success: true,
      data: {
        session_id: session.id,
        task_id: taskId,
        started_at: session.started_at,
        planned_minutes: plannedMinutes,
      },
    }
  },
  endSession(taskId, sessionId, data) {
    // B0345: 找到对应 session 关闭它（优先按 sessionId 精确定位，找不到则 fallback 到 active）
    const sessions = sessionsByTask[taskId] || []
    const active = sessions.find(s => s.id === sessionId)
      || sessions.find(s => !s.ended_at)
    if (active) {
      active.ended_at = new Date().toISOString()
      // duration 是实际秒数（B0313 + B0325 契约）
      active.actual_seconds = data?.duration ?? null
      // 完成判定：非 early_end + actual_seconds >= planned_minutes * 60 * 0.95
      const threshold = (active.planned_minutes || 25) * 60 * 0.95
      active.completed = !data?.early_end
        && typeof active.actual_seconds === 'number'
        && active.actual_seconds >= threshold
      active.auto_toggled = !!data?.auto_toggle
    }
    return {
      success: true,
      data: {
        session_id: active?.id ?? sessionId ?? null,
        task_id: taskId,
        duration: active?.actual_seconds ?? data?.duration ?? 25 * 60,
        early_end: data?.early_end ?? false,
        auto_toggle: data?.auto_toggle ?? false,
        completed: active?.completed ?? true,
        auto_toggled: active?.auto_toggled ?? false,
      },
    }
  },
  listSessions(taskId) {
    // B0327: 接受 taskId 参数；返回该 task 的真实 sessions 数组（含已结束的）
    const sessions = sessionsByTask[taskId] || []
    return {
      success: true,
      data: {
        sessions,
        total: sessions.length,
        page: 1,
        limit: 50,
      },
    }
  },
}

// 测试辅助：暴露给 vitest 重置 state（避免跨测试污染）
export function __resetMockPomodoroState() {
  Object.keys(sessionsByTask).forEach((k) => delete sessionsByTask[k])
}
// B0310 — Pomodoro mock 模块
// B0325: endSession 接受 early_end / auto_toggle 字段并回传
// B0313: startSession 接受 planned_minutes 字段（duration 兜底）
export const mockApi = {
  startSession(taskId, data) {
    // B0313: 优先读 planned_minutes（与真后端对齐），duration 兜底兼容旧调用
    const plannedMinutes = data?.planned_minutes ?? data?.duration ?? 25
    return {
      success: true,
      data: {
        session_id: 1,
        task_id: taskId,
        started_at: new Date().toISOString(),
        planned_minutes: plannedMinutes,
      },
    }
  },
  endSession(taskId, data) {
    return {
      success: true,
      data: {
        session_id: 1,
        task_id: taskId,
        duration: data?.duration || 25 * 60,
        early_end: data?.early_end ?? false,
        auto_toggle: data?.auto_toggle ?? false,
        completed: true,
        auto_toggled: data?.auto_toggle ?? false,
      },
    }
  },
  listSessions(taskId) {
    // B0327: 接受 taskId 参数；默认返 1 个 active session（fetchActivePomodoro 能命中）
    return {
      success: true,
      data: {
        sessions: [
          {
            id: 1,
            task_id: taskId,
            started_at: '2026-06-20T09:00:00',
            ended_at: null,
            planned_minutes: 25,
            actual_seconds: null,
            completed: false,
            auto_toggled: false,
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
      },
    }
  },
}
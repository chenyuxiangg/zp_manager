// B0310 + B0328-fix — Streak mock 模块
// B0328: mock 响应补齐 days_to_30/days_to_100，对齐真后端 routes/users.py:77-78
export const mockApi = {
  fetchStreak() {
    return {
      success: true,
      data: {
        current: 5,
        longest: 12,
        days_to_7: 2,
        days_to_30: 25,
        days_to_100: 95,
        last_broken_at: null,
      },
    }
  },
  fetchStreakHistory() {
    return { success: true, data: { milestones: [{ days: 7, achieved_at: '2026-06-10' }] } }
  },
}
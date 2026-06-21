// B0310 — Reports mock 模块
export const mockApi = {
  fetchWeekly() {
    return { success: true, data: { period: 'week', completed: 12, points: 240, trend: [3, 5, 4, 6, 7, 8, 9] } }
  },
  fetchMonthly() {
    return { success: true, data: { period: 'month', completed: 48, points: 960 } }
  },
  fetchYearly() {
    return { success: true, data: { period: 'year', completed: 320, points: 6400 } }
  },
  // B0322 修复：返 {data: {days, year}} 对齐真后端契约（原 cells 字段是死字段）
  fetchYearlyHeatmap(params) {
    const year = params?.year || new Date().getFullYear()
    const today = new Date()
    const days = []
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      days.push({ date: d.toISOString().slice(0, 10), count: Math.floor(Math.random() * 5) })
    }
    return { success: true, data: { year, days } }
  },
  fetchHistory(_type) {
    return { success: true, data: { reports: [] } }
  },
}
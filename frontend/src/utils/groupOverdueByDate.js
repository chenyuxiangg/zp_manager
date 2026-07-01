// PR0025 — 把 overdue 任务按 scheduled_date 分组并计算每组的展示数据
// 纯函数，不依赖 Vue，便于单测。
import dayjs from '@/plugins/dayjs'

const SEVERE_DAYS = 7 // >=7 天 = severe (red), <7 = warning (orange)

/**
 * @param {Array<{id, scheduled_date, points, status}>} tasks - overdue 任务列表
 * @param {Object} [opts]
 * @param {dayjs.Dayjs|string|Date} [opts.today] - 参考"今天"（默认当前日期）。
 *   接受 dayjs 实例或 dayjs 可解析的值；用于测试与"as of date"场景的可复现性。
 * @returns {Array<{
 *   scheduled_date: string,
 *   tasks: Array,
 *   daysOverdue: number,
 *   severity: 'severe' | 'warning',
 *   totalPoints: number,
 *   completionRate: number,
 *   taskCount: number
 * }>}
 *   按 scheduled_date 升序（最旧 = 最严重在前）
 */
export function groupOverdueByDate(tasks, opts = {}) {
  if (!Array.isArray(tasks) || tasks.length === 0) return []

  // 1) 按日期分组（Map 保留插入顺序）
  const groupMap = new Map()
  for (const t of tasks) {
    if (!groupMap.has(t.scheduled_date)) groupMap.set(t.scheduled_date, [])
    groupMap.get(t.scheduled_date).push(t)
  }

  // 2) 升序排列键（YYYY-MM-DD 字典序 = 日期序）
  const sortedDates = [...groupMap.keys()].sort()
  const today = opts.today ? dayjs(opts.today).startOf('day') : dayjs().startOf('day')

  return sortedDates.map(date => {
    const groupTasks = groupMap.get(date)
    const daysOverdue = Math.max(0, today.diff(dayjs(date), 'day'))
    const totalPoints = groupTasks.reduce((sum, t) => sum + (Number(t.points) || 0), 0)
    const completedCount = groupTasks.filter(t => t.status === 'completed').length
    const completionRate = Math.round((completedCount / groupTasks.length) * 100)

    return {
      scheduled_date: date,
      tasks: groupTasks,
      daysOverdue,
      severity: daysOverdue >= SEVERE_DAYS ? 'severe' : 'warning',
      totalPoints,
      completionRate,
      taskCount: groupTasks.length
    }
  })
}
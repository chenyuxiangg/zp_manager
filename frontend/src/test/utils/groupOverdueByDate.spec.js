// PR0025 — groupOverdueByDate 单元测试
// 把 overdue 任务按 scheduled_date 分组并计算每组的展示数据
// 用固定 today='2026-06-06' 保证测试可复现（不依赖系统时钟）
import { describe, it, expect } from 'vitest'
import { groupOverdueByDate } from '@/utils/groupOverdueByDate'

const TODAY = '2026-06-06'
const opts = { today: TODAY }

describe('groupOverdueByDate', () => {
  describe('空与无效输入', () => {
    it('空数组返回空数组', () => {
      expect(groupOverdueByDate([])).toEqual([])
    })
    it('null 返回空数组', () => {
      expect(groupOverdueByDate(null)).toEqual([])
    })
    it('undefined 返回空数组', () => {
      expect(groupOverdueByDate(undefined)).toEqual([])
    })
    it('非数组返回空数组', () => {
      expect(groupOverdueByDate('string')).toEqual([])
      expect(groupOverdueByDate({})).toEqual([])
    })
  })

  describe('排序', () => {
    it('按 scheduled_date 升序排列（旧在前）', () => {
      const tasks = [
        { id: 1, scheduled_date: '2026-06-05', points: 5 },
        { id: 2, scheduled_date: '2026-05-23', points: 5 },
        { id: 3, scheduled_date: '2026-05-30', points: 5 }
      ]
      expect(groupOverdueByDate(tasks, opts).map(g => g.scheduled_date))
        .toEqual(['2026-05-23', '2026-05-30', '2026-06-05'])
    })

    it('已是日期序的输入保持原序', () => {
      const tasks = [
        { id: 1, scheduled_date: '2026-05-23', points: 5 },
        { id: 2, scheduled_date: '2026-05-30', points: 5 },
        { id: 3, scheduled_date: '2026-06-05', points: 5 }
      ]
      expect(groupOverdueByDate(tasks, opts).map(g => g.scheduled_date))
        .toEqual(['2026-05-23', '2026-05-30', '2026-06-05'])
    })
  })

  describe('分组', () => {
    it('同日期合并到同一组', () => {
      const tasks = [
        { id: 1, scheduled_date: '2026-06-05', points: 5 },
        { id: 2, scheduled_date: '2026-06-05', points: 3 },
        { id: 3, scheduled_date: '2026-06-03', points: 2 }
      ]
      const groups = groupOverdueByDate(tasks, opts)
      expect(groups).toHaveLength(2)
      expect(groups[0].tasks).toHaveLength(1)
      expect(groups[1].tasks).toHaveLength(2)
    })

    it('同日期内任务保持输入顺序', () => {
      const tasks = [
        { id: 10, scheduled_date: '2026-06-05', points: 1 },
        { id: 20, scheduled_date: '2026-06-05', points: 2 },
        { id: 30, scheduled_date: '2026-06-05', points: 3 }
      ]
      const groups = groupOverdueByDate(tasks, opts)
      expect(groups[0].tasks.map(t => t.id)).toEqual([10, 20, 30])
    })
  })

  describe('积分聚合', () => {
    it('按组聚合 totalPoints', () => {
      const tasks = [
        { id: 1, scheduled_date: '2026-06-05', points: 10 },
        { id: 2, scheduled_date: '2026-06-05', points: 5 },
        { id: 3, scheduled_date: '2026-06-03', points: 8 }
      ]
      const groups = groupOverdueByDate(tasks, opts)
      // 升序：6-03 在前，6-05 在后
      expect(groups[0].scheduled_date).toBe('2026-06-03')
      expect(groups[0].totalPoints).toBe(8)
      expect(groups[1].scheduled_date).toBe('2026-06-05')
      expect(groups[1].totalPoints).toBe(15)
    })

    it('points 缺省或非数字按 0 聚合', () => {
      const tasks = [
        { id: 1, scheduled_date: '2026-06-05' },
        { id: 2, scheduled_date: '2026-06-05', points: null },
        { id: 3, scheduled_date: '2026-06-05', points: 'abc' }
      ]
      expect(groupOverdueByDate(tasks, opts)[0].totalPoints).toBe(0)
    })

    it('空任务列表的组 totalPoints 为 0', () => {
      expect(groupOverdueByDate([], opts)[0]).toBeUndefined()
    })
  })

  describe('严重度计算', () => {
    it('>=7 天标记 severe', () => {
      const tasks = [
        { id: 1, scheduled_date: '2026-05-30', points: 5 }, // 7 天前
        { id: 2, scheduled_date: '2026-05-23', points: 5 }  // 14 天前
      ]
      const groups = groupOverdueByDate(tasks, opts)
      expect(groups[0].severity).toBe('severe') // 14 天
      expect(groups[1].severity).toBe('severe') // 7 天
    })

    it('<7 天标记 warning', () => {
      const tasks = [
        { id: 1, scheduled_date: '2026-06-05', points: 5 }, // 1 天前
        { id: 2, scheduled_date: '2026-06-04', points: 5 }, // 2 天前
        { id: 3, scheduled_date: '2026-06-03', points: 5 }  // 3 天前
      ]
      const groups = groupOverdueByDate(tasks, opts)
      groups.forEach(g => expect(g.severity).toBe('warning'))
    })

    it('daysOverdue 准确计算', () => {
      const tasks = [
        { id: 1, scheduled_date: '2026-05-30', points: 5 }, // 7 天前
        { id: 2, scheduled_date: '2026-06-05', points: 5 }  // 1 天前
      ]
      const groups = groupOverdueByDate(tasks, opts)
      const byDate = Object.fromEntries(groups.map(g => [g.scheduled_date, g]))
      expect(byDate['2026-05-30'].daysOverdue).toBe(7)
      expect(byDate['2026-06-05'].daysOverdue).toBe(1)
    })
  })

  describe('completionRate', () => {
    it('全部 pending 时为 0', () => {
      const tasks = [
        { id: 1, scheduled_date: '2026-06-05', points: 5, status: 'pending' },
        { id: 2, scheduled_date: '2026-06-05', points: 5, status: 'pending' }
      ]
      expect(groupOverdueByDate(tasks, opts)[0].completionRate).toBe(0)
    })

    it('部分 completed 按比例', () => {
      const tasks = [
        { id: 1, scheduled_date: '2026-06-05', points: 5, status: 'completed' },
        { id: 2, scheduled_date: '2026-06-05', points: 5, status: 'pending' },
        { id: 3, scheduled_date: '2026-06-05', points: 5, status: 'pending' }
      ]
      expect(groupOverdueByDate(tasks, opts)[0].completionRate).toBe(33)
    })

    it('全部 completed 时为 100', () => {
      const tasks = [
        { id: 1, scheduled_date: '2026-06-05', points: 5, status: 'completed' },
        { id: 2, scheduled_date: '2026-06-05', points: 5, status: 'completed' }
      ]
      expect(groupOverdueByDate(tasks, opts)[0].completionRate).toBe(100)
    })
  })

  describe('taskCount', () => {
    it('返回每组任务数', () => {
      const tasks = [
        { id: 1, scheduled_date: '2026-06-05', points: 5 },
        { id: 2, scheduled_date: '2026-06-05', points: 5 },
        { id: 3, scheduled_date: '2026-06-03', points: 5 }
      ]
      const groups = groupOverdueByDate(tasks, opts)
      // 升序：6-03 在前（1 个），6-05 在后（2 个）
      expect(groups[0].scheduled_date).toBe('2026-06-03')
      expect(groups[0].taskCount).toBe(1)
      expect(groups[1].scheduled_date).toBe('2026-06-05')
      expect(groups[1].taskCount).toBe(2)
    })
  })
})
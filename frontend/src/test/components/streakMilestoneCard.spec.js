// B0328-fix — StreakMilestoneCard 组件契约测试
// 目标：守护 7/30/100 三个里程碑的展示契约 + props 透传 + 全达成态
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

describe('B0328-fix — StreakMilestoneCard 组件契约', () => {
  it('【渲染 3 个 MilestoneProgress】7/30/100 三个里程碑', async () => {
    const { default: StreakMilestoneCard } = await import('@/components/streak/StreakMilestoneCard.vue')
    const w = mount(StreakMilestoneCard, {
      props: { current: 5, daysTo7: 2, daysTo30: 25, daysTo100: 95 },
    })
    const progresses = w.findAllComponents({ name: 'MilestoneProgress' })
    expect(progresses.length).toBe(3)
  })

  it('【props 透传】daysTo7/30/100 正确传给 MilestoneProgress', async () => {
    const { default: StreakMilestoneCard } = await import('@/components/streak/StreakMilestoneCard.vue')
    const w = mount(StreakMilestoneCard, {
      props: { current: 5, daysTo7: 2, daysTo30: 25, daysTo100: 95 },
    })
    const progresses = w.findAllComponents({ name: 'MilestoneProgress' })
    expect(progresses[0].props('nextMilestone')).toBe(7)
    expect(progresses[0].props('daysToNext')).toBe(2)
    expect(progresses[1].props('nextMilestone')).toBe(30)
    expect(progresses[1].props('daysToNext')).toBe(25)
    expect(progresses[2].props('nextMilestone')).toBe(100)
    expect(progresses[2].props('daysToNext')).toBe(95)
  })

  it('【全达成态】daysTo=0,0,0 → 3 个 MilestoneProgress 都 achieved', async () => {
    const { default: StreakMilestoneCard } = await import('@/components/streak/StreakMilestoneCard.vue')
    const w = mount(StreakMilestoneCard, {
      props: { current: 120, daysTo7: 0, daysTo30: 0, daysTo100: 0 },
    })
    const progresses = w.findAllComponents({ name: 'MilestoneProgress' })
    expect(progresses.length).toBe(3)
    for (const p of progresses) {
      expect(p.props('daysToNext')).toBe(0)
    }
  })
})
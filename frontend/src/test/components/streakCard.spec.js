// PR0009 — Streak 3 组件冒烟测试
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

describe('PR0009 — Streak 组件契约', () => {
  it('【StreakCard】渲染 current/longest/nextMilestone/daysToNext', async () => {
    const { default: StreakCard } = await import('@/components/streak/StreakCard.vue')
    const w = mount(StreakCard, {
      props: { current: 12, longest: 25, nextMilestone: 30, daysToNext: 18 },
    })
    expect(w.find('.streak-card__current').text()).toBe('12')
    expect(w.text()).toContain('历史最长 25 天')
  })

  it('【StreakCard】current >= 100 不显示 milestone', async () => {
    const { default: StreakCard } = await import('@/components/streak/StreakCard.vue')
    const w = mount(StreakCard, {
      props: { current: 120, longest: 150, nextMilestone: null, daysToNext: 0 },
    })
    expect(w.text()).toContain('已达成所有里程碑')
  })

  it('【StreakFlameIcon】4 状态 class', async () => {
    const { default: StreakFlameIcon } = await import('@/components/streak/StreakFlameIcon.vue')
    expect(mount(StreakFlameIcon, { props: { current: 0 } }).classes().join(' ')).toContain('inactive')
    expect(mount(StreakFlameIcon, { props: { current: 3 } }).classes().join(' ')).toContain('active')
    expect(mount(StreakFlameIcon, { props: { current: 10 } }).classes().join(' ')).toContain('hot')
    expect(mount(StreakFlameIcon, { props: { current: 50 } }).classes().join(' ')).toContain('on-fire')
  })

  it('【MilestoneProgress】daysToNext=0 → achieved 100%', async () => {
    const { default: MilestoneProgress } = await import('@/components/streak/MilestoneProgress.vue')
    const w = mount(MilestoneProgress, {
      props: { current: 7, nextMilestone: 7, daysToNext: 0 },
    })
    expect(w.classes()).toContain('milestone-progress--achieved')
    expect(w.find('.milestone-progress__fill').attributes('style')).toContain('100%')
  })
})

// PR0007 — Reports 4 组件 + 移动端降级测试
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

describe('PR0007 — Reports 组件契约', () => {
  it('【PeriodCompareCard】delta 符号 + 颜色', async () => {
    const { default: PeriodCompareCard } = await import('@/components/reports/PeriodCompareCard.vue')
    const w = mount(PeriodCompareCard, {
      props: { title: '完成数', current: 15, previous: 10, unit: ' 个' },
    })
    expect(w.text()).toContain('+5')
    expect(w.find('.period-compare-card__delta').classes()).toContain('is-up')
  })

  it('【PeriodCompareCard】delta=负时 is-down', async () => {
    const { default: PeriodCompareCard } = await import('@/components/reports/PeriodCompareCard.vue')
    const w = mount(PeriodCompareCard, {
      props: { title: '积分', current: 50, previous: 100, unit: ' 分' },
    })
    expect(w.text()).toContain('-50')
    expect(w.find('.period-compare-card__delta').classes()).toContain('is-down')
  })

  it('【PeriodCompareCard】previous=0 且 current>0 → +∞', async () => {
    const { default: PeriodCompareCard } = await import('@/components/reports/PeriodCompareCard.vue')
    const w = mount(PeriodCompareCard, { props: { title: 't', current: 5, previous: 0 } })
    expect(w.text()).toContain('+∞')
  })

  it('【MobileFallbackTable】渲染 table + 数据', async () => {
    const { default: MobileFallbackTable } = await import('@/components/reports/MobileFallbackTable.vue')
    const w = mount(MobileFallbackTable, {
      props: {
        title: '趋势',
        columns: [{ key: 'date', label: '日期' }, { key: 'count', label: '次数' }],
        rows: [{ date: '6/1', count: 3 }, { date: '6/2', count: 5 }],
      },
    })
    expect(w.findAll('tbody tr').length).toBe(2)
  })

  it('【TrendLineChart】空数据 → empty 文案', async () => {
    const { default: TrendLineChart } = await import('@/components/reports/TrendLineChart.vue')
    const w = mount(TrendLineChart, { props: { series: [] } })
    expect(w.text()).toContain('暂无数据')
  })

  it('【CompletionHeatmap】空数据 → empty 文案', async () => {
    const { default: CompletionHeatmap } = await import('@/components/reports/CompletionHeatmap.vue')
    const w = mount(CompletionHeatmap, { props: { data: [] } })
    expect(w.text()).toContain('暂无数据')
  })
})

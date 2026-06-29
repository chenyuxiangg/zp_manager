// PR0011 — ProgressRing 死代码复活 + 扩展
// 目标: 锁定核心 API 契约 + 极值（0%/100% 钳制）+ 方向参数

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

describe('PR0011 — ProgressRing 死代码复活', () => {
  it('【渲染】value=50 → stroke-dashoffset 等于 circumference * 0.5', async () => {
    const { default: ProgressRing } = await import('@/components/common/ProgressRing.vue')
    const w = mount(ProgressRing, { props: { value: 50, size: 100, strokeWidth: 10 } })
    const circle = w.find('.progress-circle')
    expect(circle.exists()).toBe(true)
    const circumference = 2 * Math.PI * 45 // (100-10)/2 = 45
    expect(parseFloat(circle.attributes('stroke-dashoffset'))).toBeCloseTo(circumference * 0.5)
  })

  it('【钳制】value=150 → 等同 100（不超 100%）', async () => {
    const { default: ProgressRing } = await import('@/components/common/ProgressRing.vue')
    const w = mount(ProgressRing, { props: { value: 150, size: 100, strokeWidth: 10 } })
    const circle = w.find('.progress-circle')
    const circumference = 2 * Math.PI * 45
    expect(parseFloat(circle.attributes('stroke-dashoffset'))).toBeCloseTo(0, 1)
  })

  it('【钳制】value=-10 → 等同 0（不下溢）', async () => {
    const { default: ProgressRing } = await import('@/components/common/ProgressRing.vue')
    const w = mount(ProgressRing, { props: { value: -10, size: 100, strokeWidth: 10 } })
    const circle = w.find('.progress-circle')
    const circumference = 2 * Math.PI * 45
    expect(parseFloat(circle.attributes('stroke-dashoffset'))).toBeCloseTo(circumference, 0)
  })

  it('【文字】value=73 → 显示 73%', async () => {
    const { default: ProgressRing } = await import('@/components/common/ProgressRing.vue')
    const w = mount(ProgressRing, { props: { value: 73, size: 100 } })
    expect(w.find('.progress-text').text()).toBe('73%')
  })

  it('【单位】unit=" 任务" → 显示 73 任务', async () => {
    const { default: ProgressRing } = await import('@/components/common/ProgressRing.vue')
    const w = mount(ProgressRing, { props: { value: 73, unit: ' 任务' } })
    expect(w.find('.progress-text').text()).toBe('73 任务')
  })

  it('【可选文字】showText=false → 不渲染 text', async () => {
    const { default: ProgressRing } = await import('@/components/common/ProgressRing.vue')
    const w = mount(ProgressRing, { props: { value: 50, showText: false } })
    expect(w.find('.progress-text').exists()).toBe(false)
  })

  // B0252: 新增 props
  it('【label】设 label 后 svg aria-label 反映 + role=img', async () => {
    const { default: ProgressRing } = await import('@/components/common/ProgressRing.vue')
    const w = mount(ProgressRing, { props: { value: 50, label: '完成度' } })
    expect(w.find('svg').attributes('aria-label')).toBe('完成度')
    expect(w.find('svg').attributes('role')).toBe('img')
  })

  it('【thickness】thickness alias 覆盖 strokeWidth', async () => {
    const { default: ProgressRing } = await import('@/components/common/ProgressRing.vue')
    const w = mount(ProgressRing, { props: { value: 50, size: 100, thickness: 12, strokeWidth: 4 } })
    // radius = (size - strokeWidth_effective) / 2 = (100-12)/2 = 44
    const circumference = 2 * Math.PI * 44
    const circle = w.find('.progress-circle')
    expect(parseFloat(circle.attributes('stroke-dashoffset'))).toBeCloseTo(circumference * 0.5, 1)
  })

  it('【direction=countdown】value=80 → 显示 80 但 dashoffset 反向', async () => {
    const { default: ProgressRing } = await import('@/components/common/ProgressRing.vue')
    const w = mount(ProgressRing, { props: { value: 80, size: 100, strokeWidth: 10, direction: 'countdown' } })
    const circumference = 2 * Math.PI * 45
    // effectiveValue = 100 - 80 = 20, offset = circumference * 0.8
    const circle = w.find('.progress-circle')
    expect(parseFloat(circle.attributes('stroke-dashoffset'))).toBeCloseTo(circumference * 0.8, 1)
  })

  // B0336: SVG transform 必须用数值 center，"center" 关键字浏览器 SVG 解析抛 Trailing garbage
  it('【transform 数值化】size=120 → transform 用 rotate(-90 60 60) 而非字面 "center"', async () => {
    const { default: ProgressRing } = await import('@/components/common/ProgressRing.vue')
    const w = mount(ProgressRing, { props: { value: 50, size: 120 } })
    const circle = w.find('.progress-circle')
    const transform = circle.attributes('transform')
    expect(transform).toMatch(/rotate\(-90\s+60(\.0+)?\s+60(\.0+)?\)/)
    expect(transform).not.toMatch(/center/)
  })
})

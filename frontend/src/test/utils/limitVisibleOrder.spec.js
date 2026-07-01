// PR0026 v2 — limitVisibleOrder 单元测试
// 牌堆最多展示 5 张，超过时只在拖动最顶层卡片后顺序露出
import { describe, it, expect } from 'vitest'
import { limitVisibleOrder } from '@/utils/limitVisibleOrder'

describe('limitVisibleOrder', () => {
  it('空数组返回空数组', () => {
    expect(limitVisibleOrder([])).toEqual([])
  })

  it('非数组返回空数组', () => {
    expect(limitVisibleOrder(null)).toEqual([])
    expect(limitVisibleOrder(undefined)).toEqual([])
  })

  it('数组长度 < 5 时原样返回', () => {
    expect(limitVisibleOrder(['A'])).toEqual(['A'])
    expect(limitVisibleOrder(['A', 'B', 'C'])).toEqual(['A', 'B', 'C'])
    expect(limitVisibleOrder(['A', 'B', 'C', 'D', 'E'])).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('数组长度 = 5 时原样返回', () => {
    expect(limitVisibleOrder(['A', 'B', 'C', 'D', 'E'])).toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('数组长度 = 6 时只返回前 5 个', () => {
    expect(limitVisibleOrder(['A', 'B', 'C', 'D', 'E', 'F']))
      .toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('数组长度 = 8 时只返回前 5 个', () => {
    expect(limitVisibleOrder(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']))
      .toEqual(['A', 'B', 'C', 'D', 'E'])
  })

  it('不修改入参（原数组不变）', () => {
    const original = ['A', 'B', 'C', 'D', 'E', 'F']
    const result = limitVisibleOrder(original)
    expect(original).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
    expect(result).not.toBe(original)
  })

  it('支持自定义 limit', () => {
    expect(limitVisibleOrder(['A', 'B', 'C', 'D', 'E', 'F'], 3))
      .toEqual(['A', 'B', 'C'])
  })

  it('limit=0 返回空数组', () => {
    expect(limitVisibleOrder(['A', 'B', 'C'], 0)).toEqual([])
  })
})
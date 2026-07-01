// PR0026 — reorderStack 单元测试
// 拖动最上层卡片到牌堆底时，重新计算 order 数组
import { describe, it, expect } from 'vitest'
import { reorderStackAfterDrag } from '@/utils/reorderStack'

describe('reorderStackAfterDrag', () => {
  it('空数组返回空数组', () => {
    expect(reorderStackAfterDrag([], 'A')).toEqual([])
  })

  it('找不到拖动项时原样返回', () => {
    expect(reorderStackAfterDrag(['A', 'B', 'C'], 'Z')).toEqual(['A', 'B', 'C'])
  })

  it('拖动第一张到末尾，其他保持原序', () => {
    expect(reorderStackAfterDrag(['A', 'B', 'C', 'D'], 'A'))
      .toEqual(['B', 'C', 'D', 'A'])
  })

  it('拖动中间项到末尾', () => {
    expect(reorderStackAfterDrag(['A', 'B', 'C', 'D'], 'C'))
      .toEqual(['A', 'B', 'D', 'C'])
  })

  it('拖动末尾项时数组不变', () => {
    expect(reorderStackAfterDrag(['A', 'B', 'C'], 'C'))
      .toEqual(['A', 'B', 'C'])
  })

  it('只有一张卡片时拖动无效', () => {
    expect(reorderStackAfterDrag(['A'], 'A'))
      .toEqual(['A'])
  })

  it('返回新数组，不修改原数组', () => {
    const original = ['A', 'B', 'C']
    const result = reorderStackAfterDrag(original, 'A')
    expect(original).toEqual(['A', 'B', 'C'])
    expect(result).not.toBe(original)
    expect(result).toEqual(['B', 'C', 'A'])
  })

  it('拖动后保持每项唯一性', () => {
    const result = reorderStackAfterDrag(['X', 'Y', 'Z', 'W'], 'Y')
    expect(new Set(result).size).toBe(result.length)
  })
})
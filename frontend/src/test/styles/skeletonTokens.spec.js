// B0278 — skeleton 渐变硬编码消除测试
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const VARS = readFileSync(resolve(__dirname, '../../styles/variables.css'), 'utf-8')
const DASHBOARD = readFileSync(resolve(__dirname, '../../views/Dashboard.vue'), 'utf-8')
const SKELETON = readFileSync(resolve(__dirname, '../../components/common/Skeleton.vue'), 'utf-8')
const SKELETON_PLAN = readFileSync(resolve(__dirname, '../../components/common/SkeletonPlanCard.vue'), 'utf-8')

describe('【B0278 skeleton token】', () => {
  describe('variables.css', () => {
    it('定义 --skeleton-base', () => {
      expect(VARS).toMatch(/--skeleton-base\s*:/)
    })
    it('定义 --skeleton-mid', () => {
      expect(VARS).toMatch(/--skeleton-mid\s*:/)
    })
    it('定义 --skeleton-end', () => {
      expect(VARS).toMatch(/--skeleton-end\s*:/)
    })
    it('默认色值为 #f0f0f0 / #e0e0e0 / #f0f0f0', () => {
      expect(VARS).toMatch(/--skeleton-base\s*:\s*#f0f0f0/)
      expect(VARS).toMatch(/--skeleton-mid\s*:\s*#e0e0e0/)
      expect(VARS).toMatch(/--skeleton-end\s*:\s*#f0f0f0/)
    })
  })

  describe('Dashboard.vue', () => {
    it('不硬编码 #f0f0f0 / #e0e0e0', () => {
      expect(DASHBOARD).not.toMatch(/#f0f0f0/)
      expect(DASHBOARD).not.toMatch(/#e0e0e0/)
    })
    it('使用 var(--skeleton-base/mid/end)', () => {
      expect(DASHBOARD).toMatch(/var\(--skeleton-base\)/)
      expect(DASHBOARD).toMatch(/var\(--skeleton-mid\)/)
      expect(DASHBOARD).toMatch(/var\(--skeleton-end\)/)
    })
  })

  describe('Skeleton.vue', () => {
    it('不硬编码 #f0f0f0 / #e0e0e0', () => {
      expect(SKELETON).not.toMatch(/#f0f0f0/)
      expect(SKELETON).not.toMatch(/#e0e0e0/)
    })
    it('使用 var(--skeleton-base/mid/end)', () => {
      expect(SKELETON).toMatch(/var\(--skeleton-base\)/)
      expect(SKELETON).toMatch(/var\(--skeleton-mid\)/)
      expect(SKELETON).toMatch(/var\(--skeleton-end\)/)
    })
  })

  describe('SkeletonPlanCard.vue', () => {
    it('不硬编码 #f0f0f0 / #e0e0e0', () => {
      expect(SKELETON_PLAN).not.toMatch(/#f0f0f0/)
      expect(SKELETON_PLAN).not.toMatch(/#e0e0e0/)
    })
    it('使用 var(--skeleton-base/mid/end)', () => {
      expect(SKELETON_PLAN).toMatch(/var\(--skeleton-base\)/)
      expect(SKELETON_PLAN).toMatch(/var\(--skeleton-mid\)/)
      expect(SKELETON_PLAN).toMatch(/var\(--skeleton-end\)/)
    })
  })
})
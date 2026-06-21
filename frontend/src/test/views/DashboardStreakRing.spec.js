// v2.18 — AN0009 + AN0011 — Dashboard 接入 StreakCard + ProgressRing
// v2.17 漏报：Streak 组件 + ProgressRing 组件已存在但 Dashboard 0 引用
// 此测试强制要求 Dashboard 必须使用 StreakCard + ProgressRing
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const DASHBOARD = readFileSync(resolve(__dirname, '../../views/Dashboard.vue'), 'utf-8')

describe('【v2.18 AN0009+AN0011 Dashboard 接入】', () => {
  describe('【AN0009 Streak】', () => {
    it('Dashboard 导入 StreakCard', () => {
      expect(DASHBOARD).toMatch(/import\s+StreakCard\s+from\s+['"]@\/components\/streak\/StreakCard\.vue['"]/)
    })
    it('Dashboard template 使用 <StreakCard>', () => {
      expect(DASHBOARD).toMatch(/<StreakCard\b/)
    })
  })

  describe('【AN0011 ProgressRing】', () => {
    it('Dashboard 导入 ProgressRing', () => {
      expect(DASHBOARD).toMatch(/import\s+ProgressRing\s+from\s+['"]@\/components\/common\/ProgressRing\.vue['"]/)
    })
    it('Dashboard template 使用 <ProgressRing>', () => {
      expect(DASHBOARD).toMatch(/<ProgressRing\b/)
    })
  })
})
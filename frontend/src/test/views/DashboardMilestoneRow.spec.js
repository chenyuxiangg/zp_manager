// B0328-fix — Dashboard 集成测试：StreakMilestoneCard 必须接入
// 仿 DashboardStreakRing.spec.js 模式（grep import + template）
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const DASHBOARD = readFileSync(resolve(__dirname, '../../views/Dashboard.vue'), 'utf-8')

describe('【B0328-fix Dashboard 集成】StreakMilestoneCard', () => {
  it('Dashboard 导入 StreakMilestoneCard', () => {
    expect(DASHBOARD).toMatch(/import\s+StreakMilestoneCard\s+from\s+['"]@\/components\/streak\/StreakMilestoneCard\.vue['"]/)
  })

  it('Dashboard template 使用 <StreakMilestoneCard>', () => {
    expect(DASHBOARD).toMatch(/<StreakMilestoneCard\b/)
  })
})
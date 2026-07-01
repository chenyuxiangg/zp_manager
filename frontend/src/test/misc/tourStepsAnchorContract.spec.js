// B0351 — TOUR_STEPS 内容契约 + 各 anchor 在 view 中存在性守护
//
// 根因：5 步引导的 popover 标题/描述与其高亮的 selector 的目标元素没有
// 任何锁紧关系 — 之前出现 step 4 的 anchor 「task-toggle」放在 Tasks.vue
// 卡片上，但卡片本身没有可见勾选按钮（toggle 按钮 hover 才显示），文案
// 「勾选任务获得积分」与实际界面严重不匹配。
//
// 修复方向：
//   (a) TOUR_STEPS 重写 5 步 anchor 全部对齐具体页面 CTA：
//       - step 0 welcome        → Dashboard 积分卡
//       - step 1 nav-plans      → AppHeader 「计划」
//       - step 2 create-plan    → Plans.vue 「新建计划」按钮
//       - step 3 task-toggle    → Dashboard 「今日任务」h2 (永远在 DOM)
//       - step 4 nav-reports    → AppHeader 「报表」
//   (b) 跨页路由跳车 — step[2].nextRoute = '/dashboard'：
//       composable 注入 popover.onNextClick 跳路由 + 等 anchor 入 DOM 后
//       driver.drive(idx+1)。本 spec 守护：
//       - TOUR_STEPS 内容稳定（5 步 + 文案 + nextRoute 字段）
//       - 每个 anchor 在对应 view 文件中确实存在（data-guide="..."匹配）
//       - 唯一性约束：同一 data-guide 不在多处出现，避免 driver 高亮歧义

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const TOUR_STEPS = readFileSync(
  resolve(__dirname, '../../constants/tourSteps.js'),
  'utf-8',
)
const APP_HEADER = readFileSync(
  resolve(__dirname, '../../components/layout/AppHeader.vue'),
  'utf-8',
)
const NAV_CONFIG = readFileSync(
  resolve(__dirname, '../../composables/useNavConfig.js'),
  'utf-8',
)
const DASHBOARD = readFileSync(
  resolve(__dirname, '../../views/Dashboard.vue'),
  'utf-8',
)
const PLANS = readFileSync(
  resolve(__dirname, '../../views/Plans.vue'),
  'utf-8',
)
const TASKS = readFileSync(
  resolve(__dirname, '../../views/Tasks.vue'),
  'utf-8',
)

describe('B0351 — TOUR_STEPS 内容契约', () => {
  it('【内容】5 步 anchor 全部映射到具体页面 CTA（防回退到含糊文案）', () => {
    // 5 个 selector 必须都在 TOUR_STEPS 出现
    expect(TOUR_STEPS).toContain('[data-guide="welcome"]')
    expect(TOUR_STEPS).toContain('[data-guide="nav-plans"]')
    expect(TOUR_STEPS).toContain('[data-guide="create-plan"]')
    expect(TOUR_STEPS).toContain('[data-guide="task-toggle"]')
    expect(TOUR_STEPS).toContain('[data-guide="nav-reports"]')
  })

  it('【内容】step 2 nextRoute=/dashboard（引导跨页跳车到 Dashboard）', () => {
    // 必须包含 nextRoute: '/dashboard'（允许带可选空白）
    expect(TOUR_STEPS).toMatch(/nextRoute:\s*['"]\/dashboard['"]/)
  })

  it('【内容】step 3 文案「勾选任务赚积分」必须存在（B0351 修复的题眼）', () => {
    // 修复前 step 4 文案「勾选任务获得积分奖励」挂在与界面不符的 anchor 上
    // 修复后文案已贴近 Dashboard 实际可见元素
    expect(TOUR_STEPS).toMatch(/勾选任务/)
  })
})

describe('B0351 — anchor 唯一性 + 在 view 中存在', () => {
  it('【anchor 存在】[data-guide="welcome"] 在 Dashboard.vue', () => {
    expect(DASHBOARD).toMatch(/data-guide="welcome"/)
  })

  it('【anchor 存在】[data-guide="nav-plans"] 经 useNavConfig 在 AppHeader 渲染', () => {
    // AppHeader 通过 :data-guide="item.dataGuide" 渲染，源码本身无字面量
    // 锚定契约需要双层验证：useNavConfig 含 nav-plans + AppHeader 渲染绑定
    expect(NAV_CONFIG).toMatch(/dataGuide:\s*['"]nav-plans['"]/)
    expect(APP_HEADER).toMatch(/:data-guide\s*=\s*["']item\.dataGuide["']/)
  })

  it('【anchor 存在】[data-guide="create-plan"] 在 Plans.vue', () => {
    expect(PLANS).toMatch(/data-guide="create-plan"/)
  })

  it('【anchor 存在】[data-guide="task-toggle"] 在 Dashboard.vue（不再在 Tasks.vue）', () => {
    expect(DASHBOARD).toMatch(/data-guide="task-toggle"/)
    // B0351 修复点：Tasks.vue 移除 data-guide="task-toggle"（卡片默认不显示 toggle 按钮）
    expect(TASKS).not.toMatch(/data-guide="task-toggle"/)
  })

  it('【anchor 存在】[data-guide="nav-reports"] 经 useNavConfig 在 AppHeader 渲染', () => {
    expect(NAV_CONFIG).toMatch(/dataGuide:\s*['"]nav-reports['"]/)
    expect(APP_HEADER).toMatch(/:data-guide\s*=\s*["']item\.dataGuide["']/)
  })

  it('【唯一性】同一 anchor 不在多个文件出现（防 driver.js 高亮歧义）', () => {
    // nav-plans 必须在 AppHeader，不在 Plans/Dashboard 等
    expect(PLANS).not.toMatch(/data-guide="nav-plans"/)
    expect(DASHBOARD).not.toMatch(/data-guide="nav-plans"/)
    // nav-reports 必须在 AppHeader
    expect(DASHBOARD).not.toMatch(/data-guide="nav-reports"/)
    // create-plan 只在 Plans
    expect(DASHBOARD).not.toMatch(/data-guide="create-plan"/)
  })
})

// B0294 — 引导 5 步配置
// 抽离自 useOnboardingGuide 的硬编码常量；后续 RR3 配置化
// 命名约定: data-guide="<id>" 在 view 中用 element selector 引用

export const TOUR_STEPS = Object.freeze([
  { element: '[data-guide="welcome"]',     popover: { title: '欢迎来到 Zpersion',  description: '5 步学会使用 Zpersion' } },
  { element: '[data-guide="nav-plans"]',   popover: { title: '创建你的第一个计划', description: '在『计划』中创建学习计划' } },
  { element: '[data-guide="plan-detail"]', popover: { title: '拆分为阶段和任务',   description: '把计划拆分成可量化的小任务' } },
  { element: '[data-guide="task-toggle"]', popover: { title: '完成任务赚积分',     description: '勾选任务获得积分奖励' } },
  { element: '[data-guide="nav-reports"]', popover: { title: '查看你的学习报表',   description: '报表看趋势，激励持续' } },
])

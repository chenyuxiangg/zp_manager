// B0351 — 引导 5 步配置 (重写)
// 设计原则：每步 anchor 锚定到用户可看到+可点的具体 CTA，避免「popover
// 显示但 anchor 找不到 → dummy element 居中」或「标题描述与界面无关」
// 错误示范：原来第 4 步 [data-guide="task-toggle"] 在 Tasks.vue 的卡片
// 上，但卡片本身没有可见勾选按钮（toggle 按钮 hover 才显示），且整个
// 卡片 click 跳详情而不是 toggle — 用户被引导到 step 4 时看不到任何
// 「勾选任务」的入口，文案与界面错位。
//
// 现在 5 步：
//   step 0  welcome      Dashboard 积分卡          （已存在 anchor）
//   step 1  nav-plans    AppHeader 「计划」         （已存在 anchor）
//   step 2  create-plan  Plans.vue 「新建计划」按钮  （已存在 anchor，plans 页面）
//                     → nextRoute 跳 /dashboard 让 step 3 anchor 可用
//   step 3  task-toggle  Dashboard 「今日任务」h2    （新增 anchor，dashboard 页面）
//   step 4  nav-reports  AppHeader 「报表」          （已存在 anchor，AppHeader 全局可见）
//
// 跨路由跳车：step 2 → step 3 用 popover.onNextClick 跳路由 + 等 anchor
// 进入 DOM 后 driver.drive(idx+1)，由 store.startTour 注入（见
// stores/onboarding.js instrumentedSteps 逻辑）。

export const TOUR_STEPS = Object.freeze([
  {
    element: '[data-guide="welcome"]',
    popover: {
      title: '欢迎来到 Zpersion',
      description: '5 步学会使用 Zpersion',
    },
  },
  {
    element: '[data-guide="nav-plans"]',
    popover: {
      title: '找到你的学习计划',
      description: '点击顶部「计划」进入计划管理',
    },
  },
  {
    element: '[data-guide="create-plan"]',
    popover: {
      title: '创建你的第一个计划',
      description: '点击此按钮开始创建学习计划',
    },
    nextRoute: '/dashboard',
  },
  {
    element: '[data-guide="task-toggle"]',
    popover: {
      title: '勾选任务赚积分',
      description: '完成今日任务，立即获取积分奖励',
    },
  },
  {
    element: '[data-guide="nav-reports"]',
    popover: {
      title: '查看你的学习报表',
      description: '报表看趋势，激励持续',
    },
  },
])

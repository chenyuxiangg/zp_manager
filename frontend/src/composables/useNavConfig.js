// B0295 — 统一 nav 配置 (避免 AppHeader + AppLayout 重复)
// 注: admin link 守卫放在 AppHeader/AppLayout 各自使用 useAuthStore 判定
export const NAV_ITEMS = Object.freeze([
  { to: '/dashboard', label: '仪表盘', dataGuide: 'welcome' },
  { to: '/plans',     label: '计划',   dataGuide: 'nav-plans' },
  { to: '/tasks',     label: '任务' },
  { to: '/reports',   label: '报表',   dataGuide: 'nav-reports' },
  { to: '/settings',  label: '设置' },
  // admin 链接单独处理（需 is_admin 守卫）
  { to: '/admin',     label: '管理',   requiresAdmin: true },
])

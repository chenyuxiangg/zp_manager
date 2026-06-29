import { createRouter, createWebHistory } from 'vue-router'
import Login from '@/views/Login.vue'
import Register from '@/views/Register.vue'
import ForgotPassword from '@/views/ForgotPassword.vue'
import ResetPassword from '@/views/ResetPassword.vue'
import Dashboard from '@/views/Dashboard.vue'
import Plans from '@/views/Plans.vue'
import PlanDetail from '@/views/PlanDetail.vue'
import Tasks from '@/views/Tasks.vue'
import Reports from '@/views/Reports.vue'
import Settings from '@/views/Settings.vue'
import Admin from '@/views/Admin.vue'

const routes = [
  { path: '/', redirect: '/dashboard' },
  { path: '/login', component: Login, meta: { layout: 'auth' } },
  { path: '/register', component: Register, meta: { layout: 'auth' } },
  { path: '/forgot-password', component: ForgotPassword, meta: { layout: 'auth' } },
  // 重置密码走紫蓝渐变（保留原 ResetPassword 视觉特征）
  { path: '/reset-password', component: ResetPassword, meta: { layout: 'auth', layoutVariant: 'gradient' } },
  { path: '/dashboard', component: Dashboard, meta: { requiresAuth: true, layout: 'app' } },
  { path: '/plans', component: Plans, meta: { requiresAuth: true, layout: 'app' } },
  { path: '/plans/:id', component: PlanDetail, meta: { requiresAuth: true, layout: 'app' } },
  { path: '/tasks', component: Tasks, meta: { requiresAuth: true, layout: 'app' } },
  { path: '/tasks/:id', component: () => import('@/views/TaskDetail.vue'), meta: { requiresAuth: true, layout: 'app' } },
  { path: '/reports', component: Reports, meta: { requiresAuth: true, layout: 'app' } },
  { path: '/settings', component: Settings, meta: { requiresAuth: true, layout: 'app' } },
  { path: '/admin', component: Admin, meta: { requiresAuth: true, layout: 'app' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const publicPages = ['/login', '/register', '/forgot-password', '/reset-password']

router.beforeEach((to, from, next) => {
  // 防御 1: 未设 meta.layout 默认 'app' (PR0014)
  if (!to.meta.layout) to.meta.layout = 'app'
  const token = localStorage.getItem('token')
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else if (!to.meta.requiresAuth && publicPages.includes(to.path) && token) {
    next('/dashboard')
  } else {
    next()
  }
})

// PR0025 / B0119 — 引导目标路由前缀（与 TOUR_STEPS 锚点所在路由一致）
// 命中前缀 → 引导内跳转，不 destroy driver；否则 destroy + sync current_step
const TOUR_TARGET_PREFIXES = ['/dashboard', '/plans', '/tasks', '/reports']

router.afterEach((to) => {
  // 动态 import 避免 router 与 stores/onboarding 循环依赖
  // （router 早于 pinia 实例化，且 stores/onboarding 不依赖 router）
  import('@/stores/onboarding').then(({ isOnboardingActive, useOnboardingStore, getDriverInstance }) => {
    if (!isOnboardingActive()) return  // 不在引导中：no-op
    const inTourTarget = TOUR_TARGET_PREFIXES.some(
      (p) => to.path === p || to.path.startsWith(p + '/')
    )
    if (inTourTarget) return  // 引导内路由：driver 跟 view 自然渲染

    // 跳出引导目标：先 sync 当前步到 server，再 destroy
    const d = getDriverInstance()
    const activeIdx = d?.getActiveIndex?.() ?? 0
    if (d && activeIdx >= 0) {
      const store = useOnboardingStore()
      store.persistCurrentStep(activeIdx).catch(() => { /* 静默 */ })
      store.destroy()
    }
  }).catch(() => { /* 模块加载失败也不影响路由 */ })
})

export default router
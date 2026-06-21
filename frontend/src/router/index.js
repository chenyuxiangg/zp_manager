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
  { path: '/reset-password', component: ResetPassword, meta: { layout: 'auth' } },
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

export default router
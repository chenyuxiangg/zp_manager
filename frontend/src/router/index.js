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
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { path: '/forgot-password', component: ForgotPassword },
  { path: '/reset-password', component: ResetPassword },
  { path: '/dashboard', component: Dashboard, meta: { requiresAuth: true } },
  { path: '/plans', component: Plans, meta: { requiresAuth: true } },
  { path: '/plans/:id', component: PlanDetail, meta: { requiresAuth: true } },
  { path: '/tasks', component: Tasks, meta: { requiresAuth: true } },
  { path: '/tasks/:id', component: () => import('@/views/TaskDetail.vue'), meta: { requiresAuth: true } },
  { path: '/reports', component: Reports, meta: { requiresAuth: true } },
  { path: '/settings', component: Settings, meta: { requiresAuth: true } },
  { path: '/admin', component: Admin, meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

const publicPages = ['/login', '/register', '/forgot-password', '/reset-password']

router.beforeEach((to, from, next) => {
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
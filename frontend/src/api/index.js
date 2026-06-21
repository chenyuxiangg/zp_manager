import axios from 'axios'
import { useToast } from '@/composables/useToast'
import { handleMock } from '@/mocks'
import { handleApiError } from './interceptor'

// 是否走 mock 模式（开发期脱离后端联调）
const useMock = import.meta.env.VITE_USE_MOCK === 'true'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.request.use(
  async (config) => {
    // 1. Mock 模式：根据 URL 路由到 mock 数据
    if (useMock) {
      const mockResult = await handleMock(
        config.method,
        config.url,
        config.data ? (typeof config.data === 'string' ? JSON.parse(config.data) : config.data) : undefined
      )
      if (mockResult) {
        // 用 axios adapter 短路请求：直接返回 mock 数据，不真正发 HTTP
        config.adapter = async () => ({
          data: mockResult,
          status: 200,
          statusText: 'OK (Mock)',
          headers: {},
          config,
        })
      }
    }

    // 2. 附加 Authorization 头
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const config = error.config || {}
    const skipErrorToast = config.skipErrorToast === true

    // B0311：401 软跳保留在 index.js（需要本地 router 实例）+ PR0013 守卫
    // 其余 4xx/5xx/network 一律交给 handleApiError 统一处理（按 code 精确分支）
    if (error.response?.status === 401 && !skipErrorToast) {
      // B0287: 软跳用 router.push（不再用 location.href 硬刷，避免 in-memory state 丢失）
      // 调用方传 skipErrorToast: true 时由 Login.vue 自行处理
      localStorage.removeItem('token')
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { useRouter } = require('vue-router')
        const router = useRouter()
        if (router.currentRoute.value.path !== '/login') {
          router.push({ path: '/login', query: { reason: 'expired' } })
        }
      } catch {
        // eslint-disable-next-line no-undef
        if (typeof window !== 'undefined') window.location.href = '/login'
      }
      return Promise.reject(error)
    }

    // 4xx（非401）/5xx/network：统一调 handleApiError 走 code-aware 分支
    let toast = null
    try {
      toast = useToast()
    } catch {
      // 非 Vue 上下文（mock/单测）降级为 null，handleApiError 内会静默
    }

    // 注入 router / auth 让 handleApiError 能处理 PR0013 401 + PERMISSION_DENIED 静默
    let router = null
    let auth = null
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const routerMod = require('vue-router')
      router = routerMod.useRouter?.() || null
    } catch {
      /* 无 router 上下文（如单元测试） */
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const authMod = require('@/stores/auth')
      auth = authMod.useAuthStore?.() || null
    } catch {
      /* 无 store 上下文 */
    }

    handleApiError(error, { toast, router, auth })
    return Promise.reject(error)
  }
)
export default api

// 评论 API
export const commentApi = {
  getComments(taskId) {
    return api.get(`/tasks/${taskId}/comments`)
  },
  addComment(taskId, content) {
    return api.post(`/tasks/${taskId}/comments`, { content })
  },
  updateComment(taskId, commentId, content) {
    return api.put(`/tasks/${taskId}/comments/${commentId}`, { content })
  },
  deleteComment(taskId, commentId) {
    return api.delete(`/tasks/${taskId}/comments/${commentId}`)
  }
}

// 管理员 API
export const adminApi = {
  getUsers(params) {
    return api.get('/admin/users', { params })
  },
  deleteUser(userId) {
    return api.delete(`/admin/users/${userId}`)
  }
}
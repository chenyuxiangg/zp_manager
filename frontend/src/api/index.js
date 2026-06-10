import axios from 'axios'
import { useToast } from '@/composables/useToast'
import { handleMock } from '@/mocks'

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

    if (error.response?.status === 401 && !skipErrorToast) {
      // 非登录场景的 401：清除 token 并跳转登录页
      // 登录场景：调用方传 skipErrorToast: true，由 Login.vue 自行处理错误
      localStorage.removeItem('token')
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (skipErrorToast) {
      // 跳过全局 toast，由调用方自己处理
      return Promise.reject(error)
    }

    let toast
    try {
      toast = useToast()
    } catch (e) {
      // 如果无法获取 toast（比如在非 Vue 上下文中），降级静默
      toast = null
    }

    if (error.response?.status === 403) {
      toast?.error('无权限操作')
    } else if (error.response?.status >= 500) {
      toast?.error('服务器错误，请稍后重试')
    } else if (!error.response) {
      toast?.error('网络连接失败，请检查网络后重试')
    } else {
      const message = error.response.data?.message || '操作失败'
      toast?.error(message)
    }
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
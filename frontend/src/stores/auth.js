import { defineStore } from 'pinia'
import api from '@/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: null,
    isRedirecting: false, // PR0013: 401 拦截中标记
  }),
  actions: {
    /** PR0013: 清本地 token + store state（不动后端） */
    clearLocalAuth() {
      this.token = null
      this.user = null
      localStorage.removeItem('token')
    },
    setRedirecting(v) {
      this.isRedirecting = !!v
    },
    async login(email, password) {
      const res = await api.post(
        '/auth/login',
        { email, password },
        { skipErrorToast: true }
      )
      if (res.success) {
        this.token = res.data.token
        this.user = res.data.user
        localStorage.setItem('token', this.token)
      }
      return res
    },
    async register(username, email, password) {
      const res = await api.post('/auth/register', { username, email, password })
      if (res.success) {
        this.token = res.data.token
        this.user = res.data.user
        localStorage.setItem('token', this.token)
      }
      return res
    },
    async fetchUser() {
      const res = await api.get('/auth/me')
      if (res.success) {
        this.user = res.data.user
      }
      return res
    },
    async logout() {
      try {
        await api.post('/auth/logout', null, { skipErrorToast: true })
      } catch (e) {
        // ignore error, logout locally anyway
      }
      this.clearLocalAuth()
    },

    // ==================== B0303: 密码重置流程 ====================
    async forgotPassword(email) {
      const res = await api.post('/auth/forgot-password', { email })
      return res
    },
    async resetPassword(token, newPassword) {
      const res = await api.post('/auth/reset-password', {
        token,
        new_password: newPassword,
      })
      return res
    },

    // ==================== B0303: 用户配置 / 积分历史 ====================
    async fetchUserProfile() {
      const res = await api.get('/users/profile')
      // B0323 + B0330: 真后端响应嵌套结构 {data: {user: {...}, stats: {...}}}
      // 拦截器已解开最外层 data，res = {user: {...}, stats: {...}}
      // 兼容层：mock 模式可能返回 {data: {user: {...}}}（旧契约）
      const userObj = res?.user || res?.data?.user
      if (userObj) {
        this.user = { ...(this.user || {}), ...userObj }
      }
      return res
    },
    async fetchPointsHistory(params) {
      const res = await api.get('/users/points/history', { params })
      return res
    },
    async updateNotifyConfig(config) {
      // B0320: 后端 PUT /users/notify-config 期望 {notify_config: {...}} 嵌套形状，
      // 直接传 config 会被后端忽略（data.get('notify_config') 拿不到）。前端统一嵌套包装。
      // B0324: 同步写本地 store.user.notify_config，保持 UI 反映一致
      if (this.user) {
        this.user = {
          ...this.user,
          notify_config: { ...(this.user.notify_config || {}), ...config },
        }
      }
      const res = await api.put('/users/notify-config', { notify_config: config })
      return res
    },
    async setOnboarded(value) {
      // B0320: 与 updateNotifyConfig 形状一致 — 统一 {notify_config: {onboarded: bool}}
      // B0324: optimistic update — 先写本地 store.user.notify_config.onboarded
      // 让 useOnboardingWatcher 立即看到变化触发重启引导；失败时回滚
      const prevValue = this.user?.notify_config?.onboarded
      if (this.user) {
        this.user = {
          ...this.user,
          notify_config: { ...(this.user.notify_config || {}), onboarded: !!value },
        }
      }
      try {
        const res = await api.put('/users/notify-config', { notify_config: { onboarded: value } })
        return res
      } catch (e) {
        // 失败回滚
        if (this.user && prevValue !== undefined) {
          this.user = {
            ...this.user,
            notify_config: { ...(this.user.notify_config || {}), onboarded: prevValue },
          }
        }
        throw e
      }
    },
    async previewNotifyFrequency(params) {
      const res = await api.get('/users/notify-config/preview-frequency', { params })
      return res
    }
  }
})
import { defineStore } from 'pinia'
import api from '@/api'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('token') || null,
    user: null
  }),
  actions: {
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
        await api.post('/auth/logout')
      } catch (e) {
        // ignore error, logout locally anyway
      }
      this.token = null
      this.user = null
      localStorage.removeItem('token')
    }
  }
})
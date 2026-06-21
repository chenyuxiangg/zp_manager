// v2.18 — Admin store
// B0303 彻底化: Admin.vue 不再直接 import { adminApi }，走 store actions
import { defineStore } from 'pinia'
import { adminApi } from '@/api'

export const useAdminStore = defineStore('admin', {
  state: () => ({
    users: [],
    currentPage: 1,
    hasMore: false,
    loading: false,
    error: '',
  }),
  actions: {
    async fetchUsers(params = { page: 1, limit: 20 }) {
      this.loading = true
      this.error = ''
      const res = await adminApi.getUsers(params)
      this.loading = false
      if (res.success) {
        this.users = res.data.users || []
        this.hasMore = this.users.length >= (params.limit || 20)
        this.currentPage = params.page || 1
      } else {
        this.error = res.error?.message || '加载失败'
      }
      return res
    },
    async loadMoreUsers() {
      const nextPage = this.currentPage + 1
      const res = await adminApi.getUsers({ page: nextPage, limit: 20 })
      if (res.success) {
        this.users.push(...(res.data.users || []))
        this.hasMore = res.data.users?.length >= 20
        this.currentPage = nextPage
      }
      return res
    },
    async deleteUser(userId) {
      const res = await adminApi.deleteUser(userId)
      if (res.success) {
        this.users = this.users.filter(u => u.id !== userId)
      }
      return res
    },
  },
})
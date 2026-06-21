// B0303 — Reports store (pass-through actions)
// 后端响应形状: GET /reports/:type → { success, data: { report: {...} } }
//              GET /reports?type=:type → { success, data: { reports: [...] } }
//              GET /reports/yearly-heatmap?year=YYYY → { success, data: { year, days } }
// store 仅作 network wrapper，view 维护本地 state 即可
import { defineStore } from 'pinia'
import api from '@/api'

export const useReportsStore = defineStore('reports', {
  state: () => ({
    loading: false,
  }),
  actions: {
    async fetchReport(type) {
      this.loading = true
      const res = await api.get(`/reports/${type}`)
      this.loading = false
      return res
    },
    async fetchHistory(type) {
      const res = await api.get('/reports', { params: { type } })
      return res
    },
    // B0322 修复：年报时独立拉 365 天热力图（与 PR0007 设计一致）
    async fetchYearlyHeatmap(year) {
      const params = year ? { year } : {}
      const res = await api.get('/reports/yearly-heatmap', { params })
      return res
    },
  },
})
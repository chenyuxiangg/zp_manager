import { defineStore } from 'pinia'
import api from '@/api'

export const usePlansStore = defineStore('plans', {
  state: () => ({
    plans: [],
    currentPlan: null,
    stages: [],
    tasks: [],
    loading: false
  }),
  actions: {
    async fetchPlans() {
      this.loading = true
      const res = await api.get('/plans')
      if (res.success) {
        this.plans = res.data.plans || []
      }
      this.loading = false
      return res
    },
    async fetchPlanDetail(planId) {
      const res = await api.get(`/plans/${planId}`)
      if (res.success) {
        this.currentPlan = res.data.plan
        this.stages = res.data.stages || []
        this.tasks = res.data.tasks || []
      }
      return res
    },
    async createPlan(data) {
      const res = await api.post('/plans', data)
      if (res.success) {
        await this.fetchPlans()
      }
      return res
    },
    async updatePlan(planId, data) {
      const res = await api.put(`/plans/${planId}`, data)
      if (res.success) {
        await this.fetchPlans()
      }
      return res
    },
    async deletePlan(planId) {
      const res = await api.delete(`/plans/${planId}`)
      if (res.success) {
        await this.fetchPlans()
      }
      return res
    },
    async createStage(planId, data) {
      const res = await api.post(`/plans/${planId}/stages`, data)
      if (res.success) {
        await this.fetchPlanDetail(planId)
      }
      return res
    },
    async updateStage(stageId, data) {
      const res = await api.put(`/stages/${stageId}`, data)
      return res
    },
    async deleteStage(stageId) {
      const res = await api.delete(`/stages/${stageId}`)
      return res
    }
  }
})
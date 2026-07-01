// B0342: TaskDetail 开启专注无反应 — pomodoro API 调用集中收口
// v2.18 架构约定：views/composables 禁止 raw api import，所有 API 走 store actions
// 原 TaskDetail.vue 直接 api.post('/tasks/{id}/pomodoro/start') 触发 ReferenceError，
// 因此点击「开始专注」后 toast 一闪而过、按钮无任何变化。
import { defineStore } from 'pinia'
import api from '@/api'

export const usePomodoroStore = defineStore('pomodoro', {
  state: () => ({
    sessions: [],
    activeSession: null,
  }),
  actions: {
    /**
     * 开始一个专注 session
     * @param {string|number} taskId
     * @param {number} plannedMinutes 计划专注分钟数
     * @returns {Promise<{success:boolean, data?:any}>}
     */
    async startPomodoro(taskId, plannedMinutes) {
      const res = await api.post(`/tasks/${taskId}/pomodoro/start`, {
        planned_minutes: plannedMinutes,
      })
      if (res.success) {
        this.activeSession = {
          id: res?.data?.session_id,
          plannedMinutes: res?.data?.planned_minutes ?? plannedMinutes,
        }
      }
      return res
    },

    /**
     * 结束当前专注 session
     * @param {string|number} taskId
     * @param {string|number} sessionId
     * @param {{early_end?:boolean, auto_toggle?:boolean, duration?:number}} payload
     * @returns {Promise<{success:boolean, data?:any}>}
     */
    async endPomodoro(taskId, sessionId, payload = {}) {
      const res = await api.post(
        `/tasks/${taskId}/pomodoro/${sessionId}/end`,
        {
          early_end: payload.early_end ?? false,
          auto_toggle: payload.auto_toggle ?? false,
          duration: payload.duration ?? 0,
        }
      )
      if (res.success) {
        this.activeSession = null
      }
      return res
    },

    /**
     * 拉取任务所有 pomodoro 历史；同时回填 active session（跨设备/刷新恢复）
     * @param {string|number} taskId
     * @returns {Promise<{success:boolean, data?:any}>}
     */
    async fetchPomodoroSessions(taskId) {
      const res = await api.get(`/tasks/${taskId}/pomodoros`)
      if (res.success) {
        // B0347: 兼容两端字段名 — mock 返 `data.sessions`，真后端 routes/pomodoro.py 返 `data.pomodoros`
        // B0327 把 mock 改 sessions 时误以为与真后端对齐，但真后端实际是 pomodoros 字段（数据库复数命名）
        const sessions = res?.data?.sessions || res?.data?.pomodoros || []
        this.sessions = sessions
        const active = sessions.find((s) => !s.ended_at)
        if (active) {
          this.activeSession = { id: active.id, plannedMinutes: active.planned_minutes }
        }
      }
      return res
    },
  },
})
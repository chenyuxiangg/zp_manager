import { defineStore } from 'pinia'
import api, { commentApi } from '@/api'

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    todayTasks: [],
    overdueTasks: [],
    allTasks: [],
    currentTask: null,
    taskComments: [],
    loading: false
  }),
  actions: {
    async fetchTodayTasks() {
      const res = await api.get('/tasks/today')
      if (res.success) {
        this.todayTasks = res.data.tasks || []
      }
      return res
    },
    async fetchOverdueTasks() {
      const res = await api.get('/tasks/overdue')
      if (res.success) {
        this.overdueTasks = res.data.tasks || []
      }
      return res
    },
    async fetchAllTasks() {
      const res = await api.get('/tasks')
      if (res.success) {
        this.allTasks = res.data.tasks || []
      }
      return res
    },
    async completeTask(taskId) {
      const res = await api.put(`/tasks/${taskId}/complete`)
      return res
    },
    async fetchTasks() {
      this.loading = true
      await Promise.all([
        this.fetchTodayTasks(),
        this.fetchOverdueTasks(),
        this.fetchAllTasks()
      ])
      this.loading = false
    },

    // ==================== 任务详情（TaskDetail.vue 使用） ====================
    async fetchTaskDetail(taskId) {
      const res = await api.get(`/tasks/${taskId}`)
      if (res.success) {
        this.currentTask = res.data.task
      }
      return res
    },

    async updateTask(taskId, data) {
      const res = await api.put(`/tasks/${taskId}`, data)
      if (res.success && this.currentTask) {
        Object.assign(this.currentTask, data)
      }
      return res
    },

    async deleteTask(taskId) {
      const res = await api.delete(`/tasks/${taskId}`)
      return res
    },

    async toggleTaskComplete(taskId) {
      // PATCH /tasks/:id/toggle（后端 toggle 实现，含积分回滚）
      const res = await api.patch(`/tasks/${taskId}/toggle`)
      if (res.success && res.data?.task) {
        this.currentTask = res.data.task
      }
      return res
    },

    // ==================== 评论（TaskDetail.vue 使用，复用 commentApi） ====================
    async fetchTaskComments(taskId) {
      const res = await commentApi.getComments(taskId)
      if (res.success) {
        this.taskComments = res.data.comments || []
      }
      return res
    },

    async addComment(taskId, content) {
      const res = await commentApi.addComment(taskId, content)
      if (res.success && res.data?.comment) {
        this.taskComments.push(res.data.comment)
      }
      return res
    },

    async updateComment(taskId, commentId, content) {
      const res = await commentApi.updateComment(taskId, commentId, content)
      if (res.success) {
        const idx = this.taskComments.findIndex(c => c.id === commentId)
        if (idx > -1) {
          this.taskComments[idx].content = content
        }
      }
      return res
    },

    async deleteComment(taskId, commentId) {
      const res = await commentApi.deleteComment(taskId, commentId)
      if (res.success) {
        this.taskComments = this.taskComments.filter(c => c.id !== commentId)
      }
      return res
    }
  }
})

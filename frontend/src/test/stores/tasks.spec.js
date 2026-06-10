// useTasksStore 测试 - TDD
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupTestPinia } from '@/test/helpers/store-mock'

// Mock @/api 整个模块
const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn()
}
const mockCommentApi = {
  getComments: vi.fn(),
  addComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn()
}
vi.mock('@/api', () => ({
  default: mockApi,
  commentApi: mockCommentApi
}))

describe('useTasksStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTestPinia()
  })

  describe('initial state', () => {
    it('has currentTask: null and taskComments: []', async () => {
      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      expect(tasks.currentTask).toBeNull()
      expect(tasks.taskComments).toEqual([])
    })

    it('preserves existing state fields', async () => {
      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      expect(tasks.todayTasks).toEqual([])
      expect(tasks.overdueTasks).toEqual([])
      expect(tasks.allTasks).toEqual([])
      expect(tasks.loading).toBe(false)
    })
  })

  describe('fetchTaskDetail(taskId)', () => {
    it('success: calls api.get, sets currentTask to res.data.task', async () => {
      const fakeTask = { id: 5, title: 'Test', status: 'pending' }
      mockApi.get.mockResolvedValue({ success: true, data: { task: fakeTask } })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      const res = await tasks.fetchTaskDetail(5)

      expect(mockApi.get).toHaveBeenCalledWith('/tasks/5')
      expect(res.success).toBe(true)
      expect(tasks.currentTask).toEqual(fakeTask)
    })

    it('failure: returns res, leaves currentTask unchanged', async () => {
      const failRes = { success: false, error: { code: 'NOT_FOUND' } }
      mockApi.get.mockResolvedValue(failRes)

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      const res = await tasks.fetchTaskDetail(99)

      expect(res).toBe(failRes)
      expect(tasks.currentTask).toBeNull()
    })
  })

  describe('updateTask(taskId, data)', () => {
    it('success: calls api.put, Object.assigns data into currentTask', async () => {
      mockApi.put.mockResolvedValue({ success: true, data: { task: { id: 1, title: 'New' } } })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      tasks.currentTask = { id: 1, title: 'Old', status: 'pending' }

      const res = await tasks.updateTask(1, { title: 'New' })

      expect(mockApi.put).toHaveBeenCalledWith('/tasks/1', { title: 'New' })
      expect(res.success).toBe(true)
      expect(tasks.currentTask.title).toBe('New')
      expect(tasks.currentTask.status).toBe('pending') // 保留原 status
    })

    it('success but currentTask is null: skips merge, returns res', async () => {
      mockApi.put.mockResolvedValue({ success: true })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      const res = await tasks.updateTask(1, { title: 'X' })

      expect(res.success).toBe(true)
      expect(tasks.currentTask).toBeNull()
    })

    it('failure: returns res, currentTask not mutated', async () => {
      const failRes = { success: false, error: { code: 'VALIDATION_ERROR' } }
      mockApi.put.mockResolvedValue(failRes)

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      tasks.currentTask = { id: 1, title: 'Original' }

      const res = await tasks.updateTask(1, { title: 'X' })

      expect(res).toBe(failRes)
      expect(tasks.currentTask.title).toBe('Original')
    })
  })

  describe('deleteTask(taskId)', () => {
    it('calls api.delete with correct url, returns res', async () => {
      const okRes = { success: true, data: {} }
      mockApi.delete.mockResolvedValue(okRes)

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      const res = await tasks.deleteTask(7)

      expect(mockApi.delete).toHaveBeenCalledWith('/tasks/7')
      expect(res).toBe(okRes)
    })
  })

  describe('toggleTaskComplete(taskId)', () => {
    it('success with res.data.task: updates currentTask', async () => {
      const updatedTask = { id: 1, status: 'completed', completed_at: '2026-06-06T10:00:00Z' }
      mockApi.patch.mockResolvedValue({ success: true, data: { task: updatedTask, points_delta: 10 } })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      tasks.currentTask = { id: 1, status: 'pending' }

      const res = await tasks.toggleTaskComplete(1)

      expect(mockApi.patch).toHaveBeenCalledWith('/tasks/1/toggle')
      expect(tasks.currentTask).toEqual(updatedTask)
    })

    it('success without res.data.task: returns res, does not touch currentTask', async () => {
      mockApi.patch.mockResolvedValue({ success: true, data: {} })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      tasks.currentTask = { id: 1, status: 'pending' }

      await tasks.toggleTaskComplete(1)

      expect(tasks.currentTask).toEqual({ id: 1, status: 'pending' })
    })

    it('failure: returns res, does not touch currentTask', async () => {
      mockApi.patch.mockResolvedValue({ success: false, error: { code: 'NOT_FOUND' } })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      tasks.currentTask = { id: 1, status: 'pending' }

      await tasks.toggleTaskComplete(1)

      expect(tasks.currentTask).toEqual({ id: 1, status: 'pending' })
    })
  })

  describe('fetchTaskComments(taskId)', () => {
    it('success: calls commentApi.getComments, sets taskComments to res.data.comments', async () => {
      const comments = [{ id: 1, content: 'Hi' }, { id: 2, content: 'Hello' }]
      mockCommentApi.getComments.mockResolvedValue({ success: true, data: { comments } })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      const res = await tasks.fetchTaskComments(1)

      expect(mockCommentApi.getComments).toHaveBeenCalledWith(1)
      expect(tasks.taskComments).toEqual(comments)
    })

    it('handles empty array: taskComments = []', async () => {
      mockCommentApi.getComments.mockResolvedValue({ success: true, data: { comments: [] } })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      tasks.taskComments = [{ id: 99, content: 'stale' }]

      await tasks.fetchTaskComments(1)

      expect(tasks.taskComments).toEqual([])
    })

    it('handles missing comments field: taskComments = []', async () => {
      mockCommentApi.getComments.mockResolvedValue({ success: true, data: {} })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()

      await tasks.fetchTaskComments(1)

      expect(tasks.taskComments).toEqual([])
    })
  })

  describe('addComment(taskId, content)', () => {
    it('calls commentApi.addComment, appends res.data.comment to taskComments', async () => {
      const newComment = { id: 10, content: '<p>New</p>' }
      mockCommentApi.addComment.mockResolvedValue({ success: true, data: { comment: newComment } })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      tasks.taskComments = [{ id: 1, content: 'old' }]

      await tasks.addComment(1, '<p>New</p>')

      expect(mockCommentApi.addComment).toHaveBeenCalledWith(1, '<p>New</p>')
      expect(tasks.taskComments).toHaveLength(2)
      expect(tasks.taskComments[1]).toEqual(newComment)
    })
  })

  describe('updateComment(taskId, commentId, content)', () => {
    it('replaces content in matching comment by id', async () => {
      mockCommentApi.updateComment.mockResolvedValue({ success: true, data: { comment: {} } })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      tasks.taskComments = [
        { id: 1, content: 'old1' },
        { id: 2, content: 'old2' }
      ]

      await tasks.updateComment(1, 2, 'updated2')

      expect(mockCommentApi.updateComment).toHaveBeenCalledWith(1, 2, 'updated2')
      expect(tasks.taskComments[0].content).toBe('old1')
      expect(tasks.taskComments[1].content).toBe('updated2')
    })

    it('no-op if commentId not in taskComments', async () => {
      mockCommentApi.updateComment.mockResolvedValue({ success: true })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      tasks.taskComments = [{ id: 1, content: 'old' }]

      await tasks.updateComment(1, 99, 'updated')

      expect(tasks.taskComments[0].content).toBe('old')
    })
  })

  describe('deleteComment(taskId, commentId)', () => {
    it('filters out the comment with matching id', async () => {
      mockCommentApi.deleteComment.mockResolvedValue({ success: true })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      tasks.taskComments = [
        { id: 1, content: 'a' },
        { id: 2, content: 'b' },
        { id: 3, content: 'c' }
      ]

      await tasks.deleteComment(1, 2)

      expect(mockCommentApi.deleteComment).toHaveBeenCalledWith(1, 2)
      expect(tasks.taskComments).toHaveLength(2)
      expect(tasks.taskComments.map(c => c.id)).toEqual([1, 3])
    })

    it('no-op if commentId not in taskComments', async () => {
      mockCommentApi.deleteComment.mockResolvedValue({ success: true })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      tasks.taskComments = [{ id: 1, content: 'a' }]

      await tasks.deleteComment(1, 99)

      expect(tasks.taskComments).toHaveLength(1)
    })
  })

  describe('regression — existing actions', () => {
    it('fetchTodayTasks: success stores into todayTasks', async () => {
      mockApi.get.mockResolvedValue({ success: true, data: { tasks: [{ id: 1 }] } })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      await tasks.fetchTodayTasks()

      expect(mockApi.get).toHaveBeenCalledWith('/tasks/today')
      expect(tasks.todayTasks).toEqual([{ id: 1 }])
    })

    it('fetchOverdueTasks: success stores into overdueTasks', async () => {
      mockApi.get.mockResolvedValue({ success: true, data: { tasks: [{ id: 2 }] } })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      await tasks.fetchOverdueTasks()

      expect(mockApi.get).toHaveBeenCalledWith('/tasks/overdue')
      expect(tasks.overdueTasks).toEqual([{ id: 2 }])
    })

    it('fetchAllTasks: success stores into allTasks', async () => {
      mockApi.get.mockResolvedValue({ success: true, data: { tasks: [{ id: 3 }] } })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      await tasks.fetchAllTasks()

      expect(mockApi.get).toHaveBeenCalledWith('/tasks')
      expect(tasks.allTasks).toEqual([{ id: 3 }])
    })

    it('completeTask: calls api.put, returns res', async () => {
      const okRes = { success: true, data: { task: { id: 1, status: 'completed' } } }
      mockApi.put.mockResolvedValue(okRes)

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      const res = await tasks.completeTask(1)

      expect(mockApi.put).toHaveBeenCalledWith('/tasks/1/complete')
      expect(res).toBe(okRes)
    })

    it('fetchTasks: fetches all 3 in parallel, manages loading state', async () => {
      mockApi.get.mockResolvedValue({ success: true, data: { tasks: [] } })

      const { useTasksStore } = await import('@/stores/tasks')
      const tasks = useTasksStore()
      await tasks.fetchTasks()

      expect(mockApi.get).toHaveBeenCalledTimes(3)
      expect(mockApi.get).toHaveBeenCalledWith('/tasks/today')
      expect(mockApi.get).toHaveBeenCalledWith('/tasks/overdue')
      expect(mockApi.get).toHaveBeenCalledWith('/tasks')
      expect(tasks.loading).toBe(false)
    })
  })
})

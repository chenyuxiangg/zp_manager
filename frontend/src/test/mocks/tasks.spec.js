// Mock 数据模块测试 - TDD
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('mocks/tasks data integrity', () => {
  let tasks

  beforeEach(async () => {
    vi.resetModules()
    tasks = await import('@/mocks/tasks')
  })

  describe('MOCK_TASK', () => {
    it('exists and has all required fields', () => {
      expect(tasks.MOCK_TASK).toBeDefined()
      const required = ['id', 'title', 'description', 'scheduled_date', 'status', 'points', 'plan_id', 'stage_id']
      required.forEach(field => {
        expect(tasks.MOCK_TASK).toHaveProperty(field)
      })
    })

    it('has valid status value', () => {
      expect(['pending', 'in_progress', 'completed', 'overdue']).toContain(tasks.MOCK_TASK.status)
    })
  })

  describe('MOCK_COMMENTS', () => {
    it('is an array', () => {
      expect(Array.isArray(tasks.MOCK_COMMENTS)).toBe(true)
    })

    it('each comment has required fields', () => {
      const required = ['id', 'user', 'username', 'content', 'created_at']
      tasks.MOCK_COMMENTS.forEach(comment => {
        required.forEach(field => {
          expect(comment).toHaveProperty(field)
        })
      })
    })
  })

  describe('MOCK_TOGGLE_RESPONSE', () => {
    it('contains task object and points_delta', () => {
      expect(tasks.MOCK_TOGGLE_RESPONSE).toHaveProperty('task')
      expect(tasks.MOCK_TOGGLE_RESPONSE).toHaveProperty('points_delta')
      expect(typeof tasks.MOCK_TOGGLE_RESPONSE.points_delta).toBe('number')
    })
  })

  describe('mockApi functions', () => {
    it('getTaskDetail returns success: true with task in data', async () => {
      const res = await tasks.mockApi.getTaskDetail(1)
      expect(res.success).toBe(true)
      expect(res.data).toHaveProperty('task')
    })

    it('updateTask merges data into task', async () => {
      const res = await tasks.mockApi.updateTask(1, { title: 'Updated' })
      expect(res.success).toBe(true)
      expect(res.data.task.title).toBe('Updated')
    })

    it('deleteTask returns success', async () => {
      const res = await tasks.mockApi.deleteTask(1)
      expect(res.success).toBe(true)
    })

    it('toggleTask returns updated task with points_delta', async () => {
      const res = await tasks.mockApi.toggleTask(1)
      expect(res.success).toBe(true)
      expect(res.data.task).toBeDefined()
      expect(typeof res.data.points_delta).toBe('number')
    })

    it('getComments returns success with comments array', async () => {
      const res = await tasks.mockApi.getComments(1)
      expect(res.success).toBe(true)
      expect(Array.isArray(res.data.comments)).toBe(true)
    })

    it('addComment returns success with new comment', async () => {
      const res = await tasks.mockApi.addComment(1, '<p>New comment</p>')
      expect(res.success).toBe(true)
      expect(res.data.comment.content).toBe('<p>New comment</p>')
    })

    it('updateComment returns success', async () => {
      const res = await tasks.mockApi.updateComment(1, 1, '<p>Updated</p>')
      expect(res.success).toBe(true)
    })

    it('deleteComment returns success', async () => {
      const res = await tasks.mockApi.deleteComment(1, 1)
      expect(res.success).toBe(true)
    })
  })
})

// src/mocks/index.js handleMock 测试
import { describe, it, expect, vi } from 'vitest'
import { handleMock } from '@/mocks/index'

describe('handleMock - request router', () => {
  it('returns null for unmapped URL', async () => {
    const result = await handleMock('get', '/unknown/path')
    expect(result).toBeNull()
  })

  describe('tasks list endpoints', () => {
    it('GET /tasks/today → success with tasks array', async () => {
      const res = await handleMock('get', '/tasks/today')
      expect(res.success).toBe(true)
      expect(Array.isArray(res.data.tasks)).toBe(true)
    })

    it('GET /tasks/overdue → success with tasks array', async () => {
      const res = await handleMock('get', '/tasks/overdue')
      expect(res.success).toBe(true)
      expect(Array.isArray(res.data.tasks)).toBe(true)
    })

    it('GET /tasks → success with tasks array', async () => {
      const res = await handleMock('get', '/tasks')
      expect(res.success).toBe(true)
      expect(Array.isArray(res.data.tasks)).toBe(true)
    })
  })

  describe('task detail endpoints', () => {
    it('GET /tasks/1 → success with task', async () => {
      const res = await handleMock('get', '/tasks/1')
      expect(res.success).toBe(true)
      expect(res.data.task.id).toBe(1)
    })

    it('GET /tasks/123 → extracts id', async () => {
      const res = await handleMock('get', '/tasks/123')
      expect(res.success).toBe(true)
      expect(res.data.task.id).toBe(123)
    })

    it('PUT /tasks/1 → success with merged task', async () => {
      const res = await handleMock('put', '/tasks/1', { title: 'Updated' })
      expect(res.success).toBe(true)
      expect(res.data.task.title).toBe('Updated')
    })

    it('DELETE /tasks/1 → success', async () => {
      const res = await handleMock('delete', '/tasks/1')
      expect(res.success).toBe(true)
    })

    it('PUT /tasks/1/complete → success with task', async () => {
      const res = await handleMock('put', '/tasks/1/complete')
      expect(res.success).toBe(true)
      expect(res.data.task).toBeDefined()
    })

    it('PATCH /tasks/1/toggle → success with task + points_delta', async () => {
      const res = await handleMock('patch', '/tasks/1/toggle')
      expect(res.success).toBe(true)
      expect(res.data.task).toBeDefined()
      expect(typeof res.data.points_delta).toBe('number')
    })
  })

  describe('comments endpoints', () => {
    it('GET /tasks/1/comments → success with comments', async () => {
      const res = await handleMock('get', '/tasks/1/comments')
      expect(res.success).toBe(true)
      expect(Array.isArray(res.data.comments)).toBe(true)
    })

    it('POST /tasks/1/comments → success with new comment', async () => {
      const res = await handleMock('post', '/tasks/1/comments', { content: '<p>Hi</p>' })
      expect(res.success).toBe(true)
      expect(res.data.comment.content).toBe('<p>Hi</p>')
    })

    it('PUT /tasks/1/comments/2 → success with updated comment', async () => {
      const res = await handleMock('put', '/tasks/1/comments/2', { content: '<p>Updated</p>' })
      expect(res.success).toBe(true)
      expect(res.data.comment.content).toBe('<p>Updated</p>')
    })

    it('DELETE /tasks/1/comments/2 → success', async () => {
      const res = await handleMock('delete', '/tasks/1/comments/2')
      expect(res.success).toBe(true)
    })
  })

  describe('auth endpoints', () => {
    it('POST /auth/login with valid credentials → success', async () => {
      const res = await handleMock('post', '/auth/login', { email: 'a@b.com', password: 'any' })
      expect(res.success).toBe(true)
      expect(res.data.token).toBeDefined()
      expect(res.data.user).toBeDefined()
    })

    it('GET /auth/me → success with user', async () => {
      const res = await handleMock('get', '/auth/me')
      expect(res.success).toBe(true)
      expect(res.data.user).toBeDefined()
    })

    it('POST /auth/logout → success', async () => {
      const res = await handleMock('post', '/auth/logout')
      expect(res.success).toBe(true)
    })
  })

  describe('does not match other methods on same path', () => {
    it('GET /tasks/1 works but POST /tasks/1 returns null', async () => {
      expect((await handleMock('get', '/tasks/1')).success).toBe(true)
      expect(await handleMock('post', '/tasks/1', {})).toBeNull()
    })
  })
})

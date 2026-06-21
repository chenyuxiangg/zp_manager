// B0326 — toggleTaskComplete source 字段契约测试
//
// 守护：
// 1. toggleTaskComplete 必传 source 字段（默认 manual）
// 2. 接受 source 参数透传
// 3. PATCH body 必含 source

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupTestPinia } from '@/test/helpers/store-mock'

const patchMock = vi.fn()
vi.mock('@/api', () => ({
  default: {
    patch: (...args) => patchMock(...args),
  },
}))

import { useTasksStore } from '@/stores/tasks'

describe('B0326 — toggleTaskComplete source 字段契约', () => {
  beforeEach(() => {
    setupTestPinia()
    patchMock.mockReset()
    patchMock.mockResolvedValue({ success: true, data: { task: { id: 1, status: 'completed' }, points_delta: 10 } })
  })

  it('【toggleTaskComplete 必传 source】默认 manual', async () => {
    const tasks = useTasksStore()
    await tasks.toggleTaskComplete(1)
    expect(patchMock).toHaveBeenCalledTimes(1)
    const [url, body] = patchMock.mock.calls[0]
    expect(url).toBe('/tasks/1/toggle')
    expect(body).toEqual({ source: 'manual' })
  })

  it('【toggleTaskComplete 接受 source 参数】pomodoro_auto_toggle 透传', async () => {
    const tasks = useTasksStore()
    await tasks.toggleTaskComplete(2, 'pomodoro_auto_toggle')
    const [, body] = patchMock.mock.calls[0]
    expect(body).toEqual({ source: 'pomodoro_auto_toggle' })
  })

  it('【PATCH body 必含 source】不被改回无 body', async () => {
    const tasks = useTasksStore()
    await tasks.toggleTaskComplete(3)
    // 关键：body 不为 undefined 或 {}
    const body = patchMock.mock.calls[0][1]
    expect(body).toBeDefined()
    expect(body.source).toBeDefined()
  })

  it('【其他 source 透传】任意字符串都透传', async () => {
    const tasks = useTasksStore()
    await tasks.toggleTaskComplete(4, 'custom_source')
    expect(patchMock.mock.calls[0][1]).toEqual({ source: 'custom_source' })
  })
})
// 通用 @/api 模块 mock 工具
import { vi } from 'vitest'

/**
 * 创建一个完整的 api mock，每个方法返回 Promise<res>
 * 默认 res 结构: { success: true, data: {} }
 */
export function createApiMock(overrides = {}) {
  return {
    get: vi.fn().mockResolvedValue({ success: true, data: {} }),
    post: vi.fn().mockResolvedValue({ success: true, data: {} }),
    put: vi.fn().mockResolvedValue({ success: true, data: {} }),
    patch: vi.fn().mockResolvedValue({ success: true, data: {} }),
    delete: vi.fn().mockResolvedValue({ success: true, data: {} }),
    ...overrides
  }
}

/**
 * 创建一个 commentApi mock
 */
export function createCommentApiMock(overrides = {}) {
  return {
    getComments: vi.fn().mockResolvedValue({ success: true, data: { comments: [] } }),
    addComment: vi.fn().mockResolvedValue({ success: true, data: { comment: {} } }),
    updateComment: vi.fn().mockResolvedValue({ success: true, data: { comment: {} } }),
    deleteComment: vi.fn().mockResolvedValue({ success: true, data: {} }),
    ...overrides
  }
}

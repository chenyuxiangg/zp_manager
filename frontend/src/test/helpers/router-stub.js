// vue-router 测试工具：创建可断言的 router mock
import { vi } from 'vitest'

export function createRouterStub(overrides = {}) {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    go: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    currentRoute: { value: { params: {}, query: {}, path: '/' } },
    ...overrides
  }
}

export function createRouteStub(overrides = {}) {
  return {
    params: {},
    query: {},
    path: '/',
    fullPath: '/',
    name: undefined,
    ...overrides
  }
}

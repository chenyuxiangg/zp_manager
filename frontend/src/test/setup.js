// 全局测试 setup
// 在每个测试文件加载前执行

import { afterEach, beforeEach, vi } from 'vitest'

// 默认开启 mock 模式（业务代码通过 VITE_USE_MOCK 切换 mock/真实 API）
vi.stubEnv('VITE_USE_MOCK', 'true')

// 清理持久化状态，防止测试间状态污染
beforeEach(() => {
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear()
  }
})

// 清理所有 timers
afterEach(() => {
  vi.useRealTimers()
})

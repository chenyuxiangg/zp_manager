// 路由配置测试 - TDD
import { describe, it, expect, beforeEach } from 'vitest'

describe('router configuration', () => {
  let router

  beforeEach(async () => {
    // 重置模块以获取最新的 router
    const { default: freshRouter } = await import('@/router')
    router = freshRouter
  })

  describe('routes', () => {
    it('/tasks/:id route exists, requires auth', () => {
      const route = router.options.routes.find(r => r.path === '/tasks/:id')
      expect(route).toBeDefined()
      expect(route.meta?.requiresAuth).toBe(true)
    })

    it('/tasks/:id route points to a component', () => {
      const route = router.options.routes.find(r => r.path === '/tasks/:id')
      // 动态 import 也算 component
      expect(route.component).toBeDefined()
    })

    it('/tasks route still exists', () => {
      const route = router.options.routes.find(r => r.path === '/tasks')
      expect(route).toBeDefined()
      expect(route.meta?.requiresAuth).toBe(true)
    })

    it('/plans/:id route still exists', () => {
      const route = router.options.routes.find(r => r.path === '/plans/:id')
      expect(route).toBeDefined()
    })
  })

  describe('navigation guard', () => {
    it('/tasks/:id route requires auth (guard will redirect unauthenticated users)', () => {
      const route = router.options.routes.find(r => r.path === '/tasks/:id')
      expect(route.meta.requiresAuth).toBe(true)
    })
  })
})

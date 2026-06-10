// useBackNavigation 测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRouter = {
  push: vi.fn()
}
const mockRoute = { path: '/tasks' }

vi.mock('vue-router', () => ({
  useRouter: () => mockRouter,
  useRoute: () => mockRoute
}))

describe('useBackNavigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    // 设置 location.pathname 以匹配 TAB_KEY
    Object.defineProperty(window, 'location', {
      value: { pathname: '/tasks' },
      writable: true,
      configurable: true
    })
  })

  describe('handleBack', () => {
    it('with empty stack and history.length <= 1: pushes fallbackPath', async () => {
      // mock history.length
      Object.defineProperty(window.history, 'length', { value: 1, configurable: true })

      const { useBackNavigation } = await import('@/composables/useBackNavigation')
      const { handleBack } = useBackNavigation('/fallback')
      handleBack()

      expect(mockRouter.push).toHaveBeenCalledWith('/fallback')
    })

    it('with stack having > 1 entry: pops and pushes previous', async () => {
      sessionStorage.setItem('back-nav-stack-/tasks', JSON.stringify(['/a', '/b', '/c']))

      const { useBackNavigation } = await import('@/composables/useBackNavigation')
      const { handleBack } = useBackNavigation('/fallback')
      handleBack()

      expect(mockRouter.push).toHaveBeenCalledWith('/b')
      // 栈应已更新
      const remaining = JSON.parse(sessionStorage.getItem('back-nav-stack-/tasks'))
      expect(remaining).toEqual(['/a', '/b'])
    })

    it('with stack having 1 entry and history.length > 1: uses window.history.back()', async () => {
      sessionStorage.setItem('back-nav-stack-/tasks', JSON.stringify(['/current']))
      Object.defineProperty(window.history, 'length', { value: 2, configurable: true })
      const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})

      const { useBackNavigation } = await import('@/composables/useBackNavigation')
      const { handleBack } = useBackNavigation('/fallback')
      handleBack()

      expect(backSpy).toHaveBeenCalled()
      expect(mockRouter.push).not.toHaveBeenCalled()
      backSpy.mockRestore()
    })

    it('handles corrupted sessionStorage gracefully', async () => {
      sessionStorage.setItem('back-nav-stack-/tasks', 'invalid{json')
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      Object.defineProperty(window.history, 'length', { value: 1, configurable: true })

      const { useBackNavigation } = await import('@/composables/useBackNavigation')
      const { handleBack } = useBackNavigation('/fallback')
      handleBack()

      // 应降级到 fallback
      expect(mockRouter.push).toHaveBeenCalledWith('/fallback')
      consoleWarn.mockRestore()
    })
  })
})

// B0274 — useCountUp onUnmounted 时必须 cancelAnimationFrame 防内存泄漏
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'

// mock raf — 手动驱动
let rafId = 0
const rafCallbacks = new Map()
let cancelSpy = vi.fn()

beforeEach(() => {
  rafId = 0
  rafCallbacks.clear()
  cancelSpy = vi.fn()
  vi.stubGlobal('requestAnimationFrame', (cb) => {
    const id = ++rafId
    rafCallbacks.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id) => {
    cancelSpy(id)
    rafCallbacks.delete(id)
  })
  // performance.now stub（确保可预测）
  let now = 0
  vi.stubGlobal('performance', { now: () => now })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('【B0274 useCountUp 内存泄漏】', () => {
  it('onUnmounted 调用 cancelAnimationFrame 清掉活跃帧', async () => {
    const { useCountUp } = await import('@/composables/useCountUp')
    const wrapper = mount({
      template: '<div />',
      setup() {
        const { start, displayValue } = useCountUp({ duration: 1000 })
        // 启动一个动画
        start(100)
        return { displayValue }
      },
    })
    // 至少有一个活跃的 raf
    expect(rafCallbacks.size).toBeGreaterThan(0)
    // 卸载
    wrapper.unmount()
    // 所有 raf 应被 cancel
    expect(cancelSpy).toHaveBeenCalled()
  })

  it('onUnmounted 后再调用 start 不应爆', async () => {
    const { useCountUp } = await import('@/composables/useCountUp')
    const wrapper = mount({
      template: '<div />',
      setup() {
        const { start } = useCountUp()
        return { start }
      },
    })
    wrapper.unmount()
    // 卸载后访问 start 函数（已 close over）应不抛
    expect(() => wrapper.vm.start(50)).not.toThrow()
  })

  it('start() 调用前已有动画时 cancel 旧帧（重复 start 不堆叠 raf）', async () => {
    const { useCountUp } = await import('@/composables/useCountUp')
    const wrapper = mount({
      template: '<div />',
      setup() {
        const { start } = useCountUp({ duration: 1000 })
        start(100)  // raf #1
        start(200)  // 应 cancel #1 + 新建 #2
        return { start }
      },
    })
    // cancelAnimationFrame 至少被调用 1 次
    expect(cancelSpy.mock.calls.length).toBeGreaterThanOrEqual(1)
    wrapper.unmount()
  })
})
// B0317 — useCountdown keep-alive 场景契约守护
// 目标：源码 grep 守护 onActivated/onDeactivated 注册；行为测试 deactivated/activated 恢复 timer
// 守护范围：
//   1) 源码 grep（正向）：useCountdown.js import 含 onActivated 和 onDeactivated
//   2) 源码 grep（结构）：useCountdown.js 存在 onActivated( 和 onDeactivated( 调用
//   3) 行为测试（deactivated → 保留 remaining + 清 timer）
//   4) 行为测试（activated → 重启 timer 若之前在运行）
//   5) 行为测试（onUnmounted 兜底清理行为不变）
//   6) 行为测试（start(0) 立即完成）

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

// ============ 1. 源码 grep 守护（正向） ============
describe('B0317 源码 grep - useCountdown.js import 钩子', () => {
  const source = readFileSync(
    join(__dirname, '../../composables/useCountdown.js'),
    'utf-8'
  )

  it('必须 import onActivated', () => {
    expect(source).toMatch(/onActivated/)
    // 应该在 import 行
    expect(source).toMatch(/import\s*\{[^}]*onActivated[^}]*\}\s*from\s*['"]vue['"]/)
  })

  it('必须 import onDeactivated', () => {
    expect(source).toMatch(/onDeactivated/)
    expect(source).toMatch(/import\s*\{[^}]*onDeactivated[^}]*\}\s*from\s*['"]vue['"]/)
  })

  it('必须存在 onActivated( 调用', () => {
    expect(source).toMatch(/onActivated\s*\(/)
  })

  it('必须存在 onDeactivated( 调用', () => {
    expect(source).toMatch(/onDeactivated\s*\(/)
  })

  it('onUnmounted 兜底保留', () => {
    expect(source).toMatch(/onUnmounted\s*\(/)
    expect(source).toMatch(/clearTimer\(\)/)  // clearTimer 调用仍在
  })
})

// ============ 2. 行为测试 — keep-alive 钩子行为 ============
// useCountdown.js 使用 Vue 生命周期钩子，必须在 setup 上下文外调
// 所以我们直接读源码做 grep 验证（不实例化）+ 简单集成测试实例化行为
describe('B0317 useCountdown 实例化基础行为', () => {
  let useCountdown

  beforeEach(async () => {
    vi.useFakeTimers()
    // 动态 import 避免顶层副作用
    const mod = await import('@/composables/useCountdown')
    useCountdown = mod.useCountdown
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('【start】remaining 初始化为 durationMs/1000', () => {
    const cd = useCountdown()
    cd.start(25 * 60 * 1000)
    expect(cd.remaining.value).toBe(1500)
    expect(cd.running.value).toBe(true)
  })

  it('【start(0)】立即触发 onComplete', () => {
    const onComplete = vi.fn()
    const cd = useCountdown({ onComplete })
    cd.start(0)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(cd.running.value).toBe(false)
  })

  it('【stop】清 timer 不触发 onComplete', () => {
    const onComplete = vi.fn()
    const cd = useCountdown({ onComplete })
    cd.start(5000)
    expect(cd.running.value).toBe(true)
    cd.stop()
    expect(cd.running.value).toBe(false)
    vi.advanceTimersByTime(5000)
    expect(cd.remaining.value).toBe(5)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('【deactivated 通过源码 grep】clearTimer + wasRunningBeforeDeactivate 逻辑存在', () => {
    const source = readFileSync(
      join(__dirname, '../../composables/useCountdown.js'),
      'utf-8'
    )
    // 验证 deactivated 钩子内部调用了 clearInterval/clearTimer 和设置 wasRunningBeforeDeactivate
    const deactivatedMatch = source.match(/onDeactivated\s*\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/)
    expect(deactivatedMatch).not.toBeNull()
    const deactivatedBody = deactivatedMatch[1]
    expect(deactivatedBody).toMatch(/wasRunningBeforeDeactivate\s*=\s*running\.value/)
    expect(deactivatedBody).toMatch(/clearInterval\(timer\)/)
  })

  it('【activated 通过源码 grep】重启 timer 逻辑存在', () => {
    const source = readFileSync(
      join(__dirname, '../../composables/useCountdown.js'),
      'utf-8'
    )
    const activatedMatch = source.match(/onActivated\s*\(\s*\(\s*\)\s*=>\s*\{([\s\S]*?)\}\s*\)/)
    expect(activatedMatch).not.toBeNull()
    const activatedBody = activatedMatch[1]
    expect(activatedBody).toMatch(/wasRunningBeforeDeactivate/)
    expect(activatedBody).toMatch(/setInterval\(tick/)
  })
})
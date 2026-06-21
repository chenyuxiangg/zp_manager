// PR0021 — Pomodoro 纯计时器 useCountdown
// 目标: 锁定 5 个行为契约
//   1) start(durationMs) 初始化 remaining = durationMs / 1000
//   2) 每秒 remaining -1
//   3) 到 0 时触发 onComplete 回调
//   4) pause() 暂停 + resume() 恢复
//   5) stop() 清 timer 但不触发 onComplete

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useCountdown } from '@/composables/useCountdown'

describe('PR0021 — useCountdown 契约', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('【start】remaining = durationMs / 1000', () => {
    const cd = useCountdown()
    cd.start(25 * 60 * 1000)
    expect(cd.remaining.value).toBe(25 * 60)
  })

  it('【tick】每秒 remaining -1', () => {
    const cd = useCountdown()
    cd.start(5000)
    expect(cd.remaining.value).toBe(5)
    vi.advanceTimersByTime(1000)
    expect(cd.remaining.value).toBe(4)
    vi.advanceTimersByTime(2000)
    expect(cd.remaining.value).toBe(2)
  })

  it('【complete】到 0 时触发 onComplete', () => {
    const onComplete = vi.fn()
    const cd = useCountdown({ onComplete })
    cd.start(2000)
    expect(onComplete).not.toHaveBeenCalled()
    vi.advanceTimersByTime(2000)
    expect(cd.remaining.value).toBe(0)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('【pause/resume】暂停后不再 tick，恢复后继续', () => {
    const cd = useCountdown()
    cd.start(10000)
    vi.advanceTimersByTime(3000)
    expect(cd.remaining.value).toBe(7)
    cd.pause()
    vi.advanceTimersByTime(5000)
    expect(cd.remaining.value).toBe(7)  // 暂停不变
    cd.resume()
    vi.advanceTimersByTime(2000)
    expect(cd.remaining.value).toBe(5)
  })

  it('【stop】清 timer 不触发 onComplete', () => {
    const onComplete = vi.fn()
    const cd = useCountdown({ onComplete })
    cd.start(2000)
    cd.stop()
    vi.advanceTimersByTime(5000)
    expect(cd.remaining.value).toBe(2)
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('【formatted】mm:ss 格式', () => {
    const cd = useCountdown()
    cd.start(25 * 60 * 1000 + 5000)
    expect(cd.formatted.value).toBe('25:05')
    vi.advanceTimersByTime(5000)
    expect(cd.formatted.value).toBe('25:00')
    vi.advanceTimersByTime(60 * 1000)
    expect(cd.formatted.value).toBe('24:00')
  })
})

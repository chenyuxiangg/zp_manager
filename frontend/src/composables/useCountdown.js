// PR0021 — Pomodoro 纯计时器 useCountdown composable
// 行为契约 (test/composables/useCountdown.spec.js 守护):
//   - start(ms): remaining = ms/1000, 开始每秒 -1
//   - 到 0 触发 onComplete
//   - pause/resume: 暂停不清 0，继续计时
//   - stop: 清 timer, 不触发 onComplete
//   - formatted: mm:ss 字符串
// B0317 — 加 keep-alive 钩子（onActivated/onDeactivated）保证切页返回后 timer 恢复
//   - test/composables/useCountdownKeepAlive.spec.js 守护 keep-alive 场景

import { ref, computed, onUnmounted, onActivated, onDeactivated } from 'vue'

export function useCountdown(options = {}) {
  const { onComplete } = options
  const remaining = ref(0)
  const running = ref(false)
  let timer = null
  // B0317: 记录 keep-alive 缓存前是否在运行，用于 onActivated 恢复
  let wasRunningBeforeDeactivate = false

  function clearTimer() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function tick() {
    if (remaining.value > 0) {
      remaining.value -= 1
      if (remaining.value <= 0) {
        remaining.value = 0
        clearTimer()
        running.value = false
        try { onComplete?.() } catch { /* ignore */ }
      }
    }
  }

  function start(durationMs) {
    clearTimer()
    remaining.value = Math.max(0, Math.floor(durationMs / 1000))
    running.value = remaining.value > 0
    if (running.value) {
      timer = setInterval(tick, 1000)
    } else {
      // durationMs <= 0 立即完成
      try { onComplete?.() } catch { /* ignore */ }
    }
  }

  function pause() {
    if (!running.value) return
    clearTimer()
    running.value = false
  }

  function resume() {
    if (running.value || remaining.value <= 0) return
    running.value = true
    timer = setInterval(tick, 1000)
  }

  function stop() {
    clearTimer()
    running.value = false
  }

  const formatted = computed(() => {
    const m = Math.floor(remaining.value / 60)
    const s = remaining.value % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  })

  // B0317: keep-alive 钩子 — 缓存时不彻底清空，重新激活时按需重启
  onActivated(() => {
    // 被 keep-alive 重新激活时，若之前在运行且有剩余时间，重启 timer
    if (wasRunningBeforeDeactivate && remaining.value > 0 && !timer) {
      running.value = true
      timer = setInterval(tick, 1000)
    }
  })
  onDeactivated(() => {
    // 被 keep-alive 缓存时，记录运行态并暂停 timer（不彻底清空）
    wasRunningBeforeDeactivate = running.value
    if (timer) {
      clearInterval(timer)
      timer = null
      running.value = false
    }
  })

  // 非 keep-alive 场景兜底清理
  onUnmounted(() => {
    clearTimer()
    wasRunningBeforeDeactivate = false
  })

  return { remaining, running, formatted, start, pause, resume, stop }
}
// PR0010 — useCountUp composable
// B0274: animation frame 内存泄漏修复 — onUnmounted 时清 animationFrame

import { ref, onMounted, onUnmounted } from 'vue'

export function useCountUp(options = {}) {
  const { duration = 1000, easing = true } = options

  const displayValue = ref(0)
  let animationFrame = null

  const animate = (start, end, duration) => {
    const startTime = performance.now()

    const step = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easeProgress = easing ? 1 - Math.pow(1 - progress, 3) : progress
      displayValue.value = Math.round(start + (end - start) * easeProgress)
      if (progress < 1) {
        animationFrame = requestAnimationFrame(step)
      } else {
        animationFrame = null
      }
    }

    animationFrame = requestAnimationFrame(step)
  }

  const start = (targetValue, options = {}) => {
    if (animationFrame) cancelAnimationFrame(animationFrame)
    const from = options.from ?? displayValue.value
    const dur = options.duration ?? duration
    animate(from, targetValue, dur)
  }

  const stop = () => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
  }

  // B0274: 显式注册 onUnmounted 清理（替代原空 onMounted）
  onUnmounted(stop)
  onMounted(() => { /* start hook for future use */ })

  return {
    displayValue,
    start,
    stop,
  }
}

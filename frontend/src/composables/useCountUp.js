import { ref, watch, onMounted } from 'vue'

export function useCountUp(options = {}) {
  const { duration = 1000, easing = true } = options

  const displayValue = ref(0)
  let animationFrame = null

  const animate = (start, end, duration) => {
    const startTime = performance.now()

    const step = (currentTime) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)

      // 缓动函数：ease-out
      const easeProgress = easing ? 1 - Math.pow(1 - progress, 3) : progress

      displayValue.value = Math.round(start + (end - start) * easeProgress)

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step)
      }
    }

    animationFrame = requestAnimationFrame(step)
  }

  const start = (targetValue, options = {}) => {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
    }

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

  onMounted(() => {
    // 组件卸载时清理
  })

  return {
    displayValue,
    start,
    stop
  }
}
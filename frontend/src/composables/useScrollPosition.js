import { onMounted, onUnmounted } from 'vue'

export function useScrollPosition(key) {
  const savePosition = () => {
    try {
      sessionStorage.setItem(`scroll-${key}`, window.scrollY.toString())
    } catch (e) {
      // sessionStorage 满时降级
    }
  }

  const restorePosition = () => {
    try {
      const saved = sessionStorage.getItem(`scroll-${key}`)
      if (saved) {
        window.scrollTo(0, parseInt(saved, 10))
      }
    } catch (e) {
      // sessionStorage 不可用
    }
  }

  const clearPosition = () => {
    try {
      sessionStorage.removeItem(`scroll-${key}`)
    } catch (e) {
      // ignore
    }
  }

  onMounted(() => {
    restorePosition()
    window.addEventListener('scroll', savePosition, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', savePosition)
    savePosition() // 离开前保存当前位置
  })

  return {
    savePosition,
    restorePosition,
    clearPosition
  }
}
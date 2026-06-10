import { ref, onMounted, onUnmounted } from 'vue'

export function useFocusTrap(containerRef, options = { autoFocus: true }) {
  const isActive = ref(false)

  const handleKeydown = (e) => {
    if (!isActive.value || !containerRef.value) return

    if (e.key === 'Escape') {
      // ESC 关闭
      isActive.value = false
      return
    }

    if (e.key === 'Tab') {
      // Tab 键循环焦点
      const focusable = containerRef.value.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      const firstFocusable = focusable[0]
      const lastFocusable = focusable[focusable.length - 1]

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault()
          lastFocusable?.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault()
          firstFocusable?.focus()
        }
      }
    }
  }

  const activate = () => {
    isActive.value = true
    if (options.autoFocus) {
      setTimeout(() => {
        const firstFocusable = containerRef.value?.querySelector(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        firstFocusable?.focus()
      }, 50)
    }
  }

  const deactivate = () => {
    isActive.value = false
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })

  return {
    isActive,
    activate,
    deactivate
  }
}

// 全局 ESC 快捷键处理器
const escHandlers = ref([])

export function useEscapeKey(callback) {
  const handler = (e) => {
    if (e.key === 'Escape') {
      callback()
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handler)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handler)
  })
}
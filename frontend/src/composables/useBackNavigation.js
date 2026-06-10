import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'

export function useBackNavigation(fallbackPath = '/') {
  const router = useRouter()
  const route = useRoute()
  const stack = ref([])

  // 每个 Tab 用 pathname 区分，避免多 Tab 互相覆盖
  const TAB_KEY = `back-nav-stack-${location.pathname}`

  const pushPath = (path) => {
    const current = stack.value[stack.value.length - 1]
    if (current !== path) {
      stack.value.push(path)
      try {
        sessionStorage.setItem(TAB_KEY, JSON.stringify(stack.value))
      } catch {
        // sessionStorage 满时降级
      }
    }
  }

  const handleBack = () => {
    try {
      const saved = sessionStorage.getItem(TAB_KEY)
      if (saved) stack.value = JSON.parse(saved)
    } catch {
      stack.value = []
    }

    if (stack.value.length > 1) {
      stack.value.pop()
      const prev = stack.value[stack.value.length - 1] || fallbackPath
      try {
        sessionStorage.setItem(TAB_KEY, JSON.stringify(stack.value))
      } catch {
        // ignore
      }
      router.push(prev)
    } else if (window.history.length > 1) {
      window.history.back()
    } else {
      router.push(fallbackPath)
    }
  }

  const handlePopState = () => {
    pushPath(location.pathname)
  }

  onMounted(() => {
    pushPath(route.path)
    window.addEventListener('popstate', handlePopState)
  })

  onUnmounted(() => {
    window.removeEventListener('popstate', handlePopState)
  })

  return {
    handleBack,
    currentPath: route.path
  }
}
import { ref } from 'vue'

let toastInstance = null

export function useToast() {
  const toasts = ref([])

  const toast = {
    success: (message, duration = 3000) => {
      const id = Date.now()
      toasts.value.push({ id, type: 'success', message, duration })
      setTimeout(() => remove(id), duration)
      return id
    },
    error: (message, duration = 5000) => {
      const id = Date.now()
      toasts.value.push({ id, type: 'error', message, duration })
      setTimeout(() => remove(id), duration)
      return id
    },
    warning: (message, duration = 5000) => {
      const id = Date.now()
      toasts.value.push({ id, type: 'warning', message, duration })
      setTimeout(() => remove(id), duration)
      return id
    },
    info: (message, duration = 3000) => {
      const id = Date.now()
      toasts.value.push({ id, type: 'info', message, duration })
      setTimeout(() => remove(id), duration)
      return id
    },
    loading: (message) => {
      const id = Date.now()
      toasts.value.push({ id, type: 'loading', message, duration: 0 })
      return id
    },
    remove: (id) => remove(id),
  }

  function remove(id) {
    const index = toasts.value.findIndex(t => t.id === id)
    if (index > -1) {
      toasts.value.splice(index, 1)
    }
  }

  return {
    toasts,
    ...toast
  }
}

// 全局单例，用于 Axios interceptor
let globalToastHandler = null

export function setGlobalToast(handler) {
  globalToastHandler = handler
}

export function getGlobalToast() {
  return globalToastHandler
}
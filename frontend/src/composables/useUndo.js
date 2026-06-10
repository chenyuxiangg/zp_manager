import { ref } from 'vue'
import { useToast } from './useToast'

const pendingUndos = ref(new Map())

export function useUndo() {
  const toast = useToast()

  const showUndoToast = (options) => {
    const { id, message, action, timeout = 5000 } = options
    const toastId = `undo-${id}`

    const undoAction = () => {
      if (typeof action === 'function') {
        action()
      }
      pendingUndos.value.delete(toastId)
    }

    toast.warning(`${message}`, {
      timeout,
      action: {
        label: '撤销',
        onClick: () => undoAction()
      }
    })

    pendingUndos.value.set(toastId, { action, id })
  }

  const undo = (toastId) => {
    const item = pendingUndos.value.get(toastId)
    if (item && typeof item.action === 'function') {
      item.action()
      pendingUndos.value.delete(toastId)
    }
  }

  const removePending = (toastId) => {
    pendingUndos.value.delete(toastId)
  }

  return {
    showUndoToast,
    undo,
    removePending
  }
}

// 用于存储待删除项的数据（跨页面撤销）
export function useDeleteRestore() {
  const restoreData = ref(new Map())

  const saveForRestore = (key, data) => {
    try {
      localStorage.setItem(`restore-${key}`, JSON.stringify(data))
      restoreData.value.set(key, data)
    } catch (e) {
      console.warn('localStorage save failed:', e)
    }
  }

  const getForRestore = (key) => {
    try {
      const data = localStorage.getItem(`restore-${key}`)
      return data ? JSON.parse(data) : null
    } catch (e) {
      return null
    }
  }

  const clearRestore = (key) => {
    localStorage.removeItem(`restore-${key}`)
    restoreData.value.delete(key)
  }

  return {
    saveForRestore,
    getForRestore,
    clearRestore
  }
}
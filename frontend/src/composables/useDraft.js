import { watch } from 'vue'

export function useDraft(key, defaultValue) {
  const loadDraft = () => {
    try {
      const saved = localStorage.getItem(`draft-${key}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        // 检查数据大小，避免 localStorage 溢出
        if (JSON.stringify(parsed).length > 2 * 1024 * 1024) {
          console.warn('Draft data too large, clearing')
          clearDraft()
          return defaultValue
        }
        return parsed
      }
    } catch (e) {
      console.warn('Failed to load draft:', e)
    }
    return defaultValue
  }

  const saveDraft = (data) => {
    try {
      const json = JSON.stringify(data)
      if (json.length > 2 * 1024 * 1024) {
        console.warn('Draft data too large, skipping save')
        return false
      }
      localStorage.setItem(`draft-${key}`, json)
      return true
    } catch (e) {
      console.warn('Failed to save draft:', e)
      return false
    }
  }

  const clearDraft = () => {
    try {
      localStorage.removeItem(`draft-${key}`)
    } catch (e) {
      console.warn('Failed to clear draft:', e)
    }
  }

  // 防抖保存
  let saveTimer = null
  const watchDraft = (dataRef, options = { debounceMs: 2000 }) => {
    const { debounceMs = 2000 } = options

    watch(dataRef, (newVal) => {
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(() => {
        saveDraft(newVal)
      }, debounceMs)
    }, { deep: true })
  }

  return {
    loadDraft,
    saveDraft,
    clearDraft,
    watchDraft
  }
}
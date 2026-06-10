import { ref, watch } from 'vue'

const MAX_CHANGE_BYTES = 2048 // 单次变化超过 2KB 不记录
const DEBOUNCE_MS = 1000    // 富文本场景用 1s 防抖

export function useInputUndo(initialValue, options = {}) {
  const { maxSize = 50, debounceMs = DEBOUNCE_MS } = options
  const history = ref([{ value: initialValue, preview: '' }])
  const pointer = ref(0)
  let debounceTimer = null

  const computePreview = (val) => {
    const str = typeof val === 'string' ? val : JSON.stringify(val)
    const preview = str.slice(0, 200)
    const hash = str.length
    return `${preview} [len:${hash}]`
  }

  const record = (newValue) => {
    if (debounceTimer) clearTimeout(debounceTimer)

    debounceTimer = setTimeout(() => {
      const prev = history.value[pointer.value]
      const prevPreview = prev?.preview || ''
      const newPreview = computePreview(newValue)

      // 变化量过大（疑似粘贴大型富文本），跳过记录
      if (Math.abs(newPreview.length - prevPreview.length) > MAX_CHANGE_BYTES) {
        return
      }

      // 如果当前指针不在最新位置，丢弃后面的历史
      if (pointer.value < history.value.length - 1) {
        history.value = history.value.slice(0, pointer.value + 1)
      }

      history.value.push({ value: newValue, preview: newPreview })
      if (history.value.length > maxSize) {
        history.value.shift()
      }
      pointer.value = history.value.length - 1
    }, debounceMs)
  }

  const undo = () => {
    if (pointer.value > 0) {
      pointer.value--
      return history.value[pointer.value].value
    }
    return null
  }

  const redo = () => {
    if (pointer.value < history.value.length - 1) {
      pointer.value++
      return history.value[pointer.value].value
    }
    return null
  }

  const bindShortcut = (onUpdate) => {
    const handleKeydown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          const val = undo()
          if (val !== null) onUpdate(val)
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault()
          const val = redo()
          if (val !== null) onUpdate(val)
        }
      }
    }

    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }

  return {
    record,
    undo,
    redo,
    bindShortcut
  }
}
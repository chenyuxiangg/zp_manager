// useDraft 测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useDraft } from '@/composables/useDraft'

describe('useDraft', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('loadDraft', () => {
    it('returns defaultValue when no draft exists', () => {
      const defaultValue = { title: 'default' }
      const { loadDraft } = useDraft('task-1', defaultValue)
      const result = loadDraft()
      expect(result).toBe(defaultValue)
    })

    it('returns parsed draft when exists', () => {
      const saved = { title: 'saved draft' }
      localStorage.setItem('draft-task-1', JSON.stringify(saved))

      const { loadDraft } = useDraft('task-1', {})
      const result = loadDraft()
      expect(result).toEqual(saved)
    })

    it('returns defaultValue on JSON parse error', () => {
      localStorage.setItem('draft-task-1', 'invalid json{')

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const defaultValue = { title: 'default' }
      const { loadDraft } = useDraft('task-1', defaultValue)
      const result = loadDraft()

      expect(result).toBe(defaultValue)
      consoleWarn.mockRestore()
    })

    it('clears oversized draft and returns defaultValue', () => {
      const huge = 'x'.repeat(3 * 1024 * 1024) // 3MB > 2MB limit
      localStorage.setItem('draft-task-1', JSON.stringify({ data: huge }))

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const defaultValue = { title: 'default' }
      const { loadDraft } = useDraft('task-1', defaultValue)
      const result = loadDraft()

      expect(result).toBe(defaultValue)
      expect(localStorage.getItem('draft-task-1')).toBeNull()
      consoleWarn.mockRestore()
    })
  })

  describe('saveDraft', () => {
    it('writes to localStorage with key prefix "draft-"', () => {
      const { saveDraft } = useDraft('task-1', {})
      const result = saveDraft({ title: 'hello' })
      expect(result).toBe(true)
      expect(localStorage.getItem('draft-task-1')).toBe(JSON.stringify({ title: 'hello' }))
    })

    it('returns false and does not save oversized data', () => {
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { saveDraft } = useDraft('task-1', {})
      const huge = { data: 'x'.repeat(3 * 1024 * 1024) }
      const result = saveDraft(huge)

      expect(result).toBe(false)
      consoleWarn.mockRestore()
    })
  })

  describe('clearDraft', () => {
    it('removes the draft from localStorage', () => {
      localStorage.setItem('draft-task-1', '{}')
      const { clearDraft } = useDraft('task-1', {})
      clearDraft()
      expect(localStorage.getItem('draft-task-1')).toBeNull()
    })
  })

  describe('watchDraft', () => {
    it('auto-saves after debounce delay', async () => {
      vi.useFakeTimers()
      const dataRef = ref({ title: 'initial' })
      const { watchDraft } = useDraft('task-1', dataRef)
      watchDraft(dataRef, { debounceMs: 1000 })

      dataRef.value.title = 'changed'
      await nextTick()

      // 在 debounce 时间内未保存
      expect(localStorage.getItem('draft-task-1')).toBeNull()

      vi.advanceTimersByTime(1000)

      expect(localStorage.getItem('draft-task-1')).toBe(JSON.stringify({ title: 'changed' }))
      vi.useRealTimers()
    })

    it('debounces multiple rapid changes', async () => {
      vi.useFakeTimers()
      const dataRef = ref({ title: 'a' })
      const { watchDraft } = useDraft('task-1', dataRef)
      watchDraft(dataRef, { debounceMs: 1000 })

      dataRef.value.title = 'b'
      await nextTick()
      vi.advanceTimersByTime(500)
      dataRef.value.title = 'c'
      await nextTick()
      vi.advanceTimersByTime(500)
      // 此时未达到 1000ms，未保存
      expect(localStorage.getItem('draft-task-1')).toBeNull()

      vi.advanceTimersByTime(1000)
      // 只保存最新值
      expect(localStorage.getItem('draft-task-1')).toBe(JSON.stringify({ title: 'c' }))
      vi.useRealTimers()
    })
  })
})

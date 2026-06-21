// PR0009 + B0328-fix — Streak 数据 store
// 契约 (test/stores/streak.spec.js 守护):
//   - fetchStreak(force) 调 GET /users/streak
//   - 5 分钟内不重复调 API (force=true 绕过)
//   - B0328: 消费后端 days_to_7/30/100 字段（B0190 设计意图）
//   - nextMilestone/daysToNextMilestone getter 从 state 读（不再 hardcode）
//   - clearStreak 重置 state + localStorage

import { defineStore } from 'pinia'
import api from '@/api'

const STORAGE_KEY = 'zpersion.streak'
const CACHE_TTL_MS = 5 * 60 * 1000  // 5 分钟

export const useStreakStore = defineStore('streak', {
  state: () => ({
    current: 0,
    longest: 0,
    daysTo7: 0,    // B0328-fix: 消费 data.days_to_7
    daysTo30: 0,   // B0328-fix: 消费 data.days_to_30
    daysTo100: 0,  // B0328-fix: 消费 data.days_to_100
    lastBrokenAt: null,
    lastFetchedAt: 0,
  }),
  getters: {
    nextMilestone(state) {
      // B0328-fix: 从 state 读（不再 hardcode current<N）
      if (state.daysTo7 > 0) return 7
      if (state.daysTo30 > 0) return 30
      if (state.daysTo100 > 0) return 100
      return null
    },
    daysToNextMilestone(state) {
      // B0328-fix: 从 state 读（不再 hardcode N-current）
      if (state.daysTo7 > 0) return state.daysTo7
      if (state.daysTo30 > 0) return state.daysTo30
      if (state.daysTo100 > 0) return state.daysTo100
      return 0
    },
  },
  actions: {
    async fetchStreak(force = false) {
      if (!force && Date.now() - this.lastFetchedAt < CACHE_TTL_MS && this.lastFetchedAt > 0) {
        return
      }
      const res = await api.get('/users/streak')
      const data = res?.data || res || {}
      this.current = data.current || 0
      this.longest = data.longest || 0
      // B0328-fix: 消费后端 days_to_7/30/100 字段，?? 0 兼容旧 localStorage
      this.daysTo7 = data.days_to_7 ?? 0
      this.daysTo30 = data.days_to_30 ?? 0
      this.daysTo100 = data.days_to_100 ?? 0
      this.lastBrokenAt = data.last_broken_at || null
      this.lastFetchedAt = Date.now()
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          current: this.current,
          longest: this.longest,
          daysTo7: this.daysTo7,
          daysTo30: this.daysTo30,
          daysTo100: this.daysTo100,
          lastFetchedAt: this.lastFetchedAt,
        }))
      } catch { /* ignore */ }
    },
    clearStreak() {
      this.current = 0
      this.longest = 0
      // B0328-fix: 重置 3 个 daysTo 字段
      this.daysTo7 = 0
      this.daysTo30 = 0
      this.daysTo100 = 0
      this.lastBrokenAt = null
      this.lastFetchedAt = 0
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    },
  },
})

// PR0022 — Settings.vue notify_config 改造的核心 composable
// v2.18: B0303 彻底化 — 不再 raw api，走 auth store actions
// 提供：DEFAULTS 常量、useNotifyConfig() 工厂
// 行为契约（test/composables/useNotifyConfig.spec.js 守护）

import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

export const DEFAULTS = {
  learn_reminder: { timing: '1 day', channels: ['email'] },
  verify_reminder: { timing: '3 days', channels: ['email'] },
  onboarded: false,
  pomodoro: {
    break_enabled: true,
    break_minutes: 5,
    background_keep_alive: true,
  },
  streak: {
    next_milestone: 7,
    flame_visible: true,
  },
}

/**
 * 缺字段时回退到 DEFAULTS（不修改原对象，避免引用污染）
 */
export function mergeWithDefaults(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULTS }
  return {
    learn_reminder: { ...DEFAULTS.learn_reminder, ...(raw.learn_reminder || {}) },
    verify_reminder: { ...DEFAULTS.verify_reminder, ...(raw.verify_reminder || {}) },
    onboarded: typeof raw.onboarded === 'boolean' ? raw.onboarded : DEFAULTS.onboarded,
    pomodoro: { ...DEFAULTS.pomodoro, ...(raw.pomodoro || {}) },
    streak: { ...DEFAULTS.streak, ...(raw.streak || {}) },
  }
}

export function useNotifyConfig() {
  const authStore = useAuthStore()
  const config = ref({ ...DEFAULTS })
  const loading = ref(false)

  async function load() {
    loading.value = true
    try {
      // v2.18: 走 authStore.fetchUserProfile
      const res = await authStore.fetchUserProfile()
      // B0323: 三层 fallback chain — 真后端 {user:{...}, stats:{...}} → mock {data:{user:{...}}} → 旧 fallback
      const user = res?.user || res?.data?.user || res?.data || res || {}
      config.value = mergeWithDefaults(user.notify_config)
    } finally {
      loading.value = false
    }
  }

  async function update() {
    // v2.18: 走 authStore.updateNotifyConfig
    const res = await authStore.updateNotifyConfig(config.value)
    return res
  }

  async function markOnboarded(value) {
    // v2.18 + B0304: 走 authStore.setOnboarded (PUT 统一端点)
    const res = await authStore.setOnboarded(value)
    // 本地同步，避免 reload
    config.value = { ...config.value, onboarded: !!value }
    return res
  }

  async function previewFrequency(from, to) {
    // v2.18: 走 authStore.previewNotifyFrequency
    const res = await authStore.previewNotifyFrequency({ from, to })
    const body = res?.data || res || {}
    return body.estimated_per_week
  }

  return {
    config,
    loading,
    load,
    update,
    markOnboarded,
    previewFrequency,
    mergeWithDefaults,
  }
}
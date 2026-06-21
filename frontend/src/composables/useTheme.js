// PR0018 — 暗色主题 useTheme composable
// 行为契约 (test/composables/useTheme.spec.js 守护):
//   - theme: 'light' | 'dark' | 'system'
//   - effectiveTheme: 'light' | 'dark' (system 时根据 matchMedia 解析)
//   - toggleTheme: light → dark → system → light 循环
//   - 改变 theme 自动同步 documentElement.dataset.theme + localStorage
//   - system 模式下监听 matchMedia 变化
//
// B0260: 模块级 state 改为 provide/inject 单例 (避免 SSR crash + HMR 串扰)

import { ref, computed, watch, inject, provide, onScopeDispose } from 'vue'

const STORAGE_KEY = 'zpersion.theme'
const CYCLE = ['light', 'dark', 'system']
const THEME_KEY = Symbol.for('zpersion.theme.state')

function safeGet(key) {
  try { return localStorage.getItem(key) } catch { return null }
}
function safeSet(key, val) {
  try { localStorage.setItem(key, val) } catch { /* ignore */ }
}

function getSystemPref() {
  if (typeof window === 'undefined') return 'light'
  const wm = window.matchMedia
  if (typeof wm !== 'function') return 'light'
  try {
    const mq = wm.call(window, '(prefers-color-scheme: dark)')
    return mq && mq.matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function attachSystemListener(systemPrefRef) {
  if (typeof window === 'undefined') return () => {}
  const wm = window.matchMedia
  if (typeof wm !== 'function') return () => {}
  let mq
  try { mq = wm.call(window, '(prefers-color-scheme: dark)') } catch { return () => {} }
  if (!mq) return () => {}
  const handler = (e) => { systemPrefRef.value = e.matches ? 'dark' : 'light' }
  if (mq.addEventListener) mq.addEventListener('change', handler)
  else if (mq.addListener) mq.addListener(handler)
  return () => {
    if (mq.removeEventListener) mq.removeEventListener('change', handler)
    else if (mq.removeListener) mq.removeListener(handler)
  }
}

/** App.vue 顶层调用一次：provide 单例 state */
export function provideTheme() {
  const cached = safeGet(STORAGE_KEY)
  const theme = ref(CYCLE.includes(cached) ? cached : 'system')
  const systemPref = ref(getSystemPref())
  provide(THEME_KEY, { theme, systemPref })
  const detach = attachSystemListener(systemPref)
  onScopeDispose(detach)
  return { theme, systemPref }
}

export function useTheme() {
  // B0260: 单例 state 通过 provide/inject；测试或独立调用 fallback 模块级
  let state = inject(THEME_KEY, null)
  if (!state) {
    if (!fallbackState.theme.value || fallbackState.theme.value === 'system') {
      const cached = safeGet(STORAGE_KEY)
      if (CYCLE.includes(cached)) fallbackState.theme.value = cached
    }
    state = fallbackState
  }
  const { theme, systemPref } = state

  const effectiveTheme = computed(() =>
    theme.value === 'system' ? systemPref.value : theme.value
  )

  function setTheme(v) {
    if (!CYCLE.includes(v)) return
    theme.value = v
    safeSet(STORAGE_KEY, v)
  }

  function toggleTheme() {
    const idx = CYCLE.indexOf(theme.value)
    const next = CYCLE[(idx + 1) % CYCLE.length]
    setTheme(next)
  }

  // 同步 DOM + 持久化
  watch(effectiveTheme, (v) => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = v
    }
  }, { immediate: true })

  watch(theme, (v) => { safeSet(STORAGE_KEY, v) })

  return { theme, effectiveTheme, setTheme, toggleTheme }
}

// 测试 fallback: 模块级 state (每个测试用 vi.resetModules 重置)
const fallbackState = {
  theme: ref('system'),
  systemPref: ref(getSystemPref()),
}

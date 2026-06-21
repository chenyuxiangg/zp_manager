// PR0018 — 暗色主题 useTheme composable
// 目标: 锁定 6 个行为契约
//   1) theme ref 默认从 localStorage/system 初始化
//   2) toggleTheme() 在 light/dark/system 三态循环
//   3) watch theme 自动应用 document.documentElement.dataset.theme
//   4) setTheme() 持久化到 localStorage
//   5) system 跟随 matchMedia 变化
//   6) provide/inject 单例 (B0260 修复)
//
// 关键：provide 在 parent，inject 在 child — 不能在同一 setup() 中

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { nextTick, defineComponent, h, provide } from 'vue'
import { mount } from '@vue/test-utils'

const STORAGE_KEY = 'zpersion.theme'

function makeParentChild(mod) {
  const Child = defineComponent({
    setup() {
      const { theme, effectiveTheme, setTheme, toggleTheme } = mod.useTheme()
      return { theme, effectiveTheme, setTheme, toggleTheme }
    },
    render: () => h('div'),
  })
  const Parent = defineComponent({
    setup() {
      mod.provideTheme()
      return () => h(Child)
    },
  })
  const w = mount(Parent)
  // findComponent 找到子实例, vm 在那里
  return w.findComponent(Child)
}

describe('PR0018 — useTheme 契约', () => {
  beforeEach(async () => {
    vi.resetModules()
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    document.documentElement.removeAttribute('data-theme')
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
    })
  })

  it('【默认值】无 localStorage 时回退到 system 偏好', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(),
    })
    const mod = await import('@/composables/useTheme')
    const w = makeParentChild(mod)
    await nextTick()
    expect(w.vm.theme).toBe('system')
    expect(w.vm.effectiveTheme).toBe('dark')
  })

  it('【localStorage】有 cached 值时优先读取', async () => {
    localStorage.setItem(STORAGE_KEY, 'dark')
    const mod = await import('@/composables/useTheme')
    const w = makeParentChild(mod)
    await nextTick()
    expect(w.vm.theme).toBe('dark')
  })

  it('【toggle】light → dark → system → light 循环', async () => {
    localStorage.setItem(STORAGE_KEY, 'light')
    const mod = await import('@/composables/useTheme')
    const w = makeParentChild(mod)
    await nextTick()
    expect(w.vm.theme).toBe('light')
    w.vm.toggleTheme()
    expect(w.vm.theme).toBe('dark')
    w.vm.toggleTheme()
    expect(w.vm.theme).toBe('system')
    w.vm.toggleTheme()
    expect(w.vm.theme).toBe('light')
  })

  it('【应用】theme 改变时 data-theme 属性同步', async () => {
    localStorage.setItem(STORAGE_KEY, 'light')
    const mod = await import('@/composables/useTheme')
    const w = makeParentChild(mod)
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('light')
    w.vm.toggleTheme()
    await nextTick()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('【setTheme】直接设值 + 持久化', async () => {
    const mod = await import('@/composables/useTheme')
    const w = makeParentChild(mod)
    await nextTick()
    w.vm.setTheme('dark')
    expect(w.vm.theme).toBe('dark')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')
    w.vm.setTheme('system')
    expect(localStorage.getItem(STORAGE_KEY)).toBe('system')
  })

  it('【system 跟随系统】matchMedia 改变时 effectiveTheme 跟随', async () => {
    const listeners = []
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: (_e, cb) => listeners.push(cb),
      removeEventListener: vi.fn(),
    })
    localStorage.setItem(STORAGE_KEY, 'system')
    const mod = await import('@/composables/useTheme')
    const w = makeParentChild(mod)
    await nextTick()
    expect(w.vm.effectiveTheme).toBe('light')
    listeners.forEach(cb => cb({ matches: true }))
    await nextTick()
    expect(w.vm.effectiveTheme).toBe('dark')
  })
})

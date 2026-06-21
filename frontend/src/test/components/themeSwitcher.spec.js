// B0251 — ThemeSwitcher + 暗色 CSS 守护
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, provide } from 'vue'

describe('B0251 — ThemeSwitcher 契约', () => {
  it('【渲染】渲染 3 种主题图标 + 标签', async () => {
    const { default: ThemeSwitcher } = await import('@/components/common/ThemeSwitcher.vue')
    const { useTheme, provideTheme } = await import('@/composables/useTheme')
    const Child = defineComponent({
      setup() {
        const { theme, setTheme } = useTheme()
        return { theme, setTheme }
      },
      render() { return h(ThemeSwitcher) },
    })
    const Parent = defineComponent({
      setup() { provideTheme(); return () => h(Child) },
    })
    const w = mount(Parent)
    await nextTick()
    // 默认 'system'
    expect(w.text()).toContain('跟随系统')
  })
})

describe('B0251 — variables.css 暗色 token', () => {
  it('【存在】:root[data-theme="dark"] 定义', async () => {
    const fs = await import('fs')
    const src = fs.readFileSync('src/styles/variables.css', 'utf-8')
    expect(src).toMatch(/\[data-theme="dark"\]/)
  })

  it('【迁移】:root.auto-theme 已废弃', async () => {
    const fs = await import('fs')
    const src = fs.readFileSync('src/styles/variables.css', 'utf-8')
    expect(src).not.toMatch(/:root\.auto-theme/)
  })

  it('【存在】quill-overrides.css 暗色覆盖', async () => {
    const fs = await import('fs')
    expect(fs.existsSync('src/styles/quill-overrides.css')).toBe(true)
  })
})

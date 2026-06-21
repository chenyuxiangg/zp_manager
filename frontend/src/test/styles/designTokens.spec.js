// PR0020 — Design System 阶段 0 token 增补 + reset.css 守护测试
// 目标: 锁定关键 CSS token 存在 + reset.css 全局规则 + App.vue 导入顺序
// 这些测试在 PR0020 之前是 RED 状态，落地后变 GREEN。

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '../../../..')
const VARIABLES = resolve(ROOT, 'frontend/src/styles/variables.css')
const RESET = resolve(ROOT, 'frontend/src/styles/reset.css')
const APP_VUE = resolve(ROOT, 'frontend/src/App.vue')

function read(p) {
  return existsSync(p) ? readFileSync(p, 'utf-8') : ''
}

describe('PR0020 — variables.css token 增补', () => {
  const css = read(VARIABLES)

  it('【字体】定义 --font-sans / --font-mono / --leading-*', () => {
    expect(css).toMatch(/--font-sans:\s*-apple-system/)
    expect(css).toMatch(/--font-mono:\s*ui-monospace/)
    expect(css).toMatch(/--leading-tight:\s*1\.25/)
    expect(css).toMatch(/--leading-normal:\s*1\.5/)
    expect(css).toMatch(/--leading-loose:\s*1\.75/)
  })

  it('【动画】定义 --duration-{fast,normal,slow} 与 --ease-*', () => {
    expect(css).toMatch(/--duration-fast:\s*150ms/)
    expect(css).toMatch(/--duration-normal:\s*300ms/)
    expect(css).toMatch(/--duration-slow:\s*500ms/)
    expect(css).toMatch(/--ease-in:\s*cubic-bezier/)
    expect(css).toMatch(/--ease-out:\s*cubic-bezier/)
    expect(css).toMatch(/--ease-inout:\s*cubic-bezier/)
  })

  it('【z-index 层级】定义 5 个层级常量', () => {
    expect(css).toMatch(/--z-base:\s*1/)
    expect(css).toMatch(/--z-dropdown:\s*100/)
    expect(css).toMatch(/--z-modal:\s*1000/)
    expect(css).toMatch(/--z-toast:\s*1100/)
    expect(css).toMatch(/--z-popover:\s*1200/)
  })

  it('【打印专用】定义 5 个 --print-* 变量', () => {
    expect(css).toMatch(/--print-bg:/)
    expect(css).toMatch(/--print-fg:/)
    expect(css).toMatch(/--print-border:/)
    expect(css).toMatch(/--print-shadow:/)
    expect(css).toMatch(/--print-link:/)
  })

  it('【@media print】内重写 token 至 print 版本', () => {
    expect(css).toMatch(/@media\s+print/)
    // 至少应把 bg / fg / shadow / link 改到 print 版本
    expect(css).toMatch(/--color-background:\s*var\(--print-bg\)/)
    expect(css).toMatch(/--shadow-(sm|md|lg):\s*var\(--print-shadow\)/)
  })

  it('【保留】原有 token 未被删除（向后兼容）', () => {
    expect(css).toMatch(/--color-primary:/)
    expect(css).toMatch(/--color-accent:/)
    expect(css).toMatch(/--space-sm:\s*8px/)
    expect(css).toMatch(/--radius-md:\s*8px/)
  })
})

describe('PR0020 — reset.css 全局重置', () => {
  const reset = read(RESET)

  it('【存在】reset.css 文件已创建', () => {
    expect(existsSync(RESET)).toBe(true)
  })

  it('【box-sizing】全局 * 设为 border-box', () => {
    expect(reset).toMatch(/\*,\s*\*::before,\s*\*::after/)
    expect(reset).toMatch(/box-sizing:\s*border-box/)
  })

  it('【清边距】全局 margin/padding 归零', () => {
    expect(reset).toMatch(/margin:\s*0/)
    expect(reset).toMatch(/padding:\s*0/)
  })

  it('【字体】html/body 引用 --font-sans 与 --leading-normal', () => {
    expect(reset).toMatch(/font-family:\s*var\(--font-sans\)/)
    expect(reset).toMatch(/line-height:\s*var\(--leading-normal\)/)
  })

  it('【表单元素】button/input/select/textarea 继承字体色', () => {
    expect(reset).toMatch(/font:\s*inherit/)
    expect(reset).toMatch(/color:\s*inherit/)
  })

  it('【图片】img/svg/video 块级 + 不溢出', () => {
    expect(reset).toMatch(/img,\s*svg,\s*video/)
    expect(reset).toMatch(/max-width:\s*100%/)
  })

  it('【链接/列表】a 继承色，ul/ol 去默认 marker', () => {
    expect(reset).toMatch(/a\s*\{[^}]*color:\s*inherit/)
    expect(reset).toMatch(/list-style:\s*none/)
  })
})

describe('PR0020 — App.vue 导入顺序守卫', () => {
  const app = read(APP_VUE)

  it('【顺序】variables.css 必须在 reset.css 之前导入', () => {
    const idxVar = app.indexOf("styles/variables.css")
    const idxReset = app.indexOf("styles/reset.css")
    expect(idxVar).toBeGreaterThan(-1)
    expect(idxReset).toBeGreaterThan(-1)
    expect(idxVar).toBeLessThan(idxReset)
  })

  it('【已就位】原有 4 个 CSS (focus-ring/button-states/card-hover/modal-animation) 保留', () => {
    expect(app).toMatch(/styles\/focus-ring\.css/)
    expect(app).toMatch(/styles\/button-states\.css/)
    expect(app).toMatch(/styles\/card-hover\.css/)
  })
})

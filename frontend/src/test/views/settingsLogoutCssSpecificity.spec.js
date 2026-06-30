// B0342 — Settings.vue `.btn-logout` CSS 选择器特异性修复契约
// 目标: 锁定 .btn-logout 必须用复合选择器覆盖 .settings-section button 的 accent 样式
//   1) 源码 grep：Settings.vue 必须含 `.settings-section .btn-logout {`
//   2) 源码 grep：复合选择器块内必须含 `background: transparent`（覆盖 accent）
//   3) 源码 grep：复合选择器块内必须含 `color: var(--text-primary)`（覆盖 white）
// 根因：原 `.settings-section button { background: var(--color-accent); color: white; }` 特异性 11 > .btn-logout 10
// 修复：加 `.settings-section .btn-logout { ... }` 复合选择器，特异性升至 20+
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SETTINGS = readFileSync(
  resolve(__dirname, '../../views/Settings.vue'),
  'utf-8'
)

describe('【B0342】 Settings.vue `.btn-logout` CSS 特异性修复', () => {
  it('【源码 grep】必须含 .settings-section .btn-logout 复合选择器', () => {
    expect(SETTINGS).toMatch(/\.settings-section\s+\.btn-logout\s*\{/)
  })

  it('【源码 grep】复合选择器内必须 background: transparent（覆盖 accent）', () => {
    // 抓取复合选择器块内容
    const m = SETTINGS.match(/\.settings-section\s+\.btn-logout\s*\{([\s\S]*?)\}/)
    expect(m, '必须存在 .settings-section .btn-logout 复合选择器块').not.toBeNull()
    expect(m[1]).toMatch(/background:\s*transparent/)
  })

  it('【源码 grep】复合选择器内必须 color: var(--text-primary)（覆盖 white）', () => {
    const m = SETTINGS.match(/\.settings-section\s+\.btn-logout\s*\{([\s\S]*?)\}/)
    expect(m, '必须存在 .settings-section .btn-logout 复合选择器块').not.toBeNull()
    expect(m[1]).toMatch(/color:\s*var\(--text-primary\)/)
  })

  it('【回归】原 .btn-logout 基础选择器保留（hover/disabled 等状态）', () => {
    // 基础 .btn-logout 选择器仍需保留（hover/disabled 等状态样式）
    expect(SETTINGS).toMatch(/\.btn-logout\s*\{/)
    // hover 状态
    expect(SETTINGS).toMatch(/\.btn-logout:hover/)
    // disabled 状态
    expect(SETTINGS).toMatch(/\.btn-logout:disabled/)
  })
})
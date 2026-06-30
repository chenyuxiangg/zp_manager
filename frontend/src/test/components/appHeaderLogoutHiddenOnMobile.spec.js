// B0342 — AppHeader 移动端隐藏 logout 按钮契约（B0341 风险 2 收尾）
// 目标: 锁定 <768px 时 AppHeader logout 隐藏，移动端只走抽屉底部入口
//   1) 源码 grep：AppHeader.vue @media (max-width: 768px) 块内含 .app-header__logout
//   2) 源码 grep：块内含 display: none
//   3) 源码 grep反向：AppHeader.vue 不在 .app-header__logout 基础选择器中加 display:none（应放 media 内）
// 决策：D1=A 用户确认隐藏 AppHeader logout，移动端只走抽屉入口
// 根因：B0341 实施时 media query 只隐藏 nav，未同步隐藏 actions 内的 logout
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const APP_HEADER = readFileSync(
  resolve(__dirname, '../../components/layout/AppHeader.vue'),
  'utf-8'
)

describe('【B0342】 AppHeader 移动端隐藏 logout 按钮', () => {
  it('【源码 grep】@media (max-width: 768px) 块内必须含 .app-header__logout { display: none; }', () => {
    // 抓取 media query 块内容
    const m = APP_HEADER.match(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n\}/)
    expect(m, '必须存在 @media (max-width: 768px) 块').not.toBeNull()
    expect(m[1]).toMatch(/\.app-header__logout\s*\{/)
    expect(m[1]).toMatch(/display:\s*none/)
  })

  it('【源码 grep】媒体查询块同时保留 nav 隐藏（B0341 已有逻辑）', () => {
    const m = APP_HEADER.match(/@media\s*\(max-width:\s*768px\)\s*\{([\s\S]*?)\n\}/)
    expect(m).not.toBeNull()
    // nav 隐藏不能丢
    expect(m[1]).toMatch(/\.app-header__nav\s*\{/)
    expect(m[1]).toMatch(/display:\s*none/)
  })

  it('【源码 grep】.app-header__logout 基础选择器不在所有 viewport 隐藏（仅移动端）', () => {
    // 基础 .app-header__logout { } 不应直接 display:none
    // 验证方法：匹配基础选择器块（不在 @media 内）
    // 简化：检查基础选择器块不含 display:none
    const baseMatch = APP_HEADER.match(/\.app-header__logout\s*\{([\s\S]*?)\}/)
    expect(baseMatch, '基础 .app-header__logout 选择器块存在').not.toBeNull()
    expect(baseMatch[1]).not.toMatch(/display:\s*none/)
  })
})
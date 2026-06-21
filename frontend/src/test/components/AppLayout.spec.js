// B0306 — AppLayout 不应硬编码 nav，应复用 useNavConfig
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const APP_LAYOUT = readFileSync(resolve(__dirname, '../../components/layout/AppLayout.vue'), 'utf-8')
const APP_HEADER = readFileSync(resolve(__dirname, '../../components/layout/AppHeader.vue'), 'utf-8')

describe('【B0306 nav 配置共享】', () => {
  it('AppLayout 导入 useNavConfig 或 NAV_ITEMS', () => {
    expect(APP_LAYOUT).toMatch(/import\s*\{[^}]*NAV_ITEMS[^}]*\}\s*from\s*['"]@\/composables\/useNavConfig['"]/)
  })

  it('AppLayout 不硬编码 5+ 个 <router-link>', () => {
    const routerLinks = APP_LAYOUT.match(/<router-link\b/g) || []
    expect(routerLinks.length).toBeLessThan(3)
  })

  it('AppLayout 使用 NAV_ITEMS.map / forEach / v-for 渲染 nav', () => {
    expect(APP_LAYOUT).toMatch(/NAV_ITEMS/)
  })

  it('AppHeader 也使用 NAV_ITEMS（reference）', () => {
    expect(APP_HEADER).toMatch(/NAV_ITEMS/)
  })
})
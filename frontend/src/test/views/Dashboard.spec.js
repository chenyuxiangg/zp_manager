// B0292 — Dashboard.vue v-html XSS 防御扫描测试
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SOURCE = readFileSync(resolve(__dirname, '../../views/Dashboard.vue'), 'utf-8')

describe('Dashboard.vue', () => {
  describe('【B0292 XSS】 task.description 渲染', () => {
    it('imports sanitizeHtml from @/utils/sanitize', () => {
      expect(SOURCE).toMatch(/import\s*\{[^}]*sanitizeHtml[^}]*\}\s*from\s*['"]@\/utils\/sanitize['"]/)
    })

    it('所有 v-html="task.description" 必须先 sanitize', () => {
      // 找到所有 v-html 引用 task.description 的行
      const matches = [...SOURCE.matchAll(/v-html="([^"]*task\.description[^"]*)"/g)]
      expect(matches.length, 'Dashboard 必须有 v-html 渲染 task.description').toBeGreaterThan(0)
      // 每个 v-html 表达式都必须包含 sanitizeHtml
      for (const m of matches) {
        expect(m[1], `v-html="${m[1]}" 必须调用 sanitizeHtml`).toMatch(/sanitizeHtml/)
      }
    })
  })
})
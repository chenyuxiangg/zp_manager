// B0297 — 4 个缺失文档/文件补齐验证
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '../../../../')

describe('【B0297 文档与配置】', () => {
  describe('docs/engineering/feature-flags.md', () => {
    const path = resolve(ROOT, 'docs/engineering/feature-flags.md')
    it('存在', () => {
      expect(existsSync(path)).toBe(true)
    })
    it('含 PR 关联说明', () => {
      const src = readFileSync(path, 'utf-8')
      expect(src).toMatch(/PR0022|PR0012|PR0009|notify_config/)
    })
    it('含 flags 列表', () => {
      const src = readFileSync(path, 'utf-8')
      expect(src).toMatch(/onboarded|pomodoro|streak/)
    })
  })

  describe('docs/engineering/frontend-debugging.md', () => {
    const path = resolve(ROOT, 'docs/engineering/frontend-debugging.md')
    it('存在', () => {
      expect(existsSync(path)).toBe(true)
    })
    it('含 401 复现步骤', () => {
      const src = readFileSync(path, 'utf-8')
      expect(src).toMatch(/401|TOKEN_EXPIRED|expired/)
    })
    it('含 Pinia state 查看指引', () => {
      const src = readFileSync(path, 'utf-8')
      expect(src).toMatch(/Pinia|useAuthStore|store/)
    })
  })

  describe('frontend/src/test/fixtures/index.js', () => {
    const path = resolve(ROOT, 'frontend/src/test/fixtures/index.js')
    it('存在', () => {
      expect(existsSync(path)).toBe(true)
    })
    it('导出 fakeUser / fakeTask 等公共 fixture', () => {
      const src = readFileSync(path, 'utf-8')
      expect(src).toMatch(/export\s+const\s+fakeUser/)
      expect(src).toMatch(/export\s+const\s+fakeTask/)
    })
  })

  describe('frontend/.stylelintrc.js', () => {
    const path = resolve(ROOT, 'frontend/.stylelintrc.js')
    it('存在', () => {
      expect(existsSync(path)).toBe(true)
    })
    it('规则禁用硬编码 hex 颜色', () => {
      const src = readFileSync(path, 'utf-8')
      expect(src).toMatch(/declaration-property-value-disallowed-list/)
      // regex 字面量含 hex 字符类（防止颜色硬编码）
      expect(src).toMatch(/\[0-9a-fA-F\]\{/)
      // 至少禁用 color / background-color / border-color 三类之一
      expect(src).toMatch(/(color|background-color|border-color)/)
    })
  })
})
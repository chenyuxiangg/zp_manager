// B0280/B0308 — Admin.vue alert/confirm 反模式消除测试
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SOURCE = readFileSync(resolve(__dirname, '../../views/Admin.vue'), 'utf-8')

describe('Admin.vue', () => {
  describe('【B0280/B0308】 移除原生 alert/confirm', () => {
    it('不能调用 window.alert()', () => {
      // 允许注释中提及，但函数调用必须 0
      const codeBlocks = SOURCE.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      expect(codeBlocks).not.toMatch(/\balert\s*\(/)
    })

    it('不能调用 window.confirm()', () => {
      const codeBlocks = SOURCE.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
      expect(codeBlocks).not.toMatch(/\bconfirm\s*\(/)
    })

    it('必须导入 useToast 或 ConfirmDialog 二选一', () => {
      const hasToast = /import\s*\{[^}]*useToast[^}]*\}\s*from\s*['"]@\/composables\/useToast['"]/.test(SOURCE)
      const hasConfirm = /import\s+ConfirmDialog\s+from\s+['"]@\/components\/common\/ConfirmDialog\.vue['"]/.test(SOURCE)
      expect(hasToast || hasConfirm, 'Admin.vue 必须 useToast 或 ConfirmDialog').toBe(true)
    })
  })
})
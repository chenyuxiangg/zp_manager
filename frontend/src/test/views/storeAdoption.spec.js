// B0303 + v2.18 — 全 src/ 不直接 raw api import（仅 stores/ 与 api/ 自身）
// 收紧版：扫 views/ + composables/ 全部文件，禁止任何 `import ... from '@/api'`
// 仅 stores/ 目录允许 import api（这是合理的依赖方向）
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, join } from 'path'

const SRC = resolve(__dirname, '../../')
const VIEWS = [
  'Admin.vue', 'ResetPassword.vue', 'Reports.vue', 'Dashboard.vue',
  'ForgotPassword.vue', 'Plans.vue', 'PlanDetail.vue', 'Settings.vue',
  'Login.vue', 'Register.vue', 'TaskDetail.vue', 'Tasks.vue',
]

function read(name) {
  return readFileSync(join(SRC, 'views', name), 'utf-8')
}

describe('【B0303 + v2.18 store actions 采用】 views', () => {
  describe.each(VIEWS)('$name', (name) => {
    const source = read(name)

    it('不应从 @/api import（任何形式）', () => {
      // 默认导入、命名空间导入、所有 `import ... from '@/api'` 全部禁止
      expect(source, `${name} 仍有 @/api import`).not.toMatch(/from\s+['"]@\/api['"]/)
    })
  })
})

// v2.18 扩展：扫 composables/ 目录，禁止任何 raw api 调用
describe('【v2.18 B0303 彻底化】 composables/ 无 raw api', () => {
  it('composables/ 下所有 .js 文件不应 import @/api', () => {
    const compDir = resolve(SRC, 'composables')
    const files = readdirSync(compDir).filter(f => f.endsWith('.js'))
    const offenders = []
    for (const f of files) {
      const src = readFileSync(join(compDir, f), 'utf-8')
      if (/from\s+['"]@\/api['"]/.test(src)) {
        offenders.push(f)
      }
    }
    expect(offenders, `composables/ 还有 raw api import: ${offenders.join(', ')}`).toEqual([])
  })
})
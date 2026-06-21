// B0310 — mocks/ 必须按模块拆分到 modules/ 子目录
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '../../mocks')
const MODULES_DIR = resolve(ROOT, 'modules')
const INDEX = readFileSync(resolve(ROOT, 'index.js'), 'utf-8')

const REQUIRED_MODULES = ['streak', 'reports', 'pomodoro', 'users', 'admin']

describe('【B0310 mocks/modules/ 拆分】', () => {
  it('mocks/modules/ 子目录存在', () => {
    expect(existsSync(MODULES_DIR)).toBe(true)
  })

  describe.each(REQUIRED_MODULES)('%s module', (name) => {
    it(`modules/${name}.js 文件存在`, () => {
      expect(existsSync(resolve(MODULES_DIR, `${name}.js`))).toBe(true)
    })

    it('导出 mockApi 对象', () => {
      const src = readFileSync(resolve(MODULES_DIR, `${name}.js`), 'utf-8')
      expect(src).toMatch(/export\s+(const|let|var|function|\{)\s*(mockApi|default|handle)/)
    })
  })

  it('mocks/index.js 引用所有 5 个模块', () => {
    for (const name of REQUIRED_MODULES) {
      expect(INDEX, `index.js 必须 import ${name}`).toMatch(new RegExp(`import\\s+\\*\\s+as\\s+${name}\\s+from\\s+['"]\\./modules\\/${name}['"]`))
    }
  })
})
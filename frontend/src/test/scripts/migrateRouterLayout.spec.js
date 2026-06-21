// PR0014 — scripts/migrate_router_layout.mjs 一次性 migration 工具测试
// 目标: 保护 route 改造正确性：自动给 public/protected route 补 meta.layout

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

const SCRIPT = join(process.cwd(), 'scripts/migrate_router_layout.mjs')

function runScript(input) {
  const dir = mkdtempSync(join(tmpdir(), 'mig-'))
  const file = join(dir, 'router.js')
  writeFileSync(file, input)
  execSync(`node ${SCRIPT} ${file}`, { stdio: 'pipe' })
  const out = readFileSync(file, 'utf-8')
  rmSync(dir, { recursive: true, force: true })
  return out
}

describe('PR0014 — migrate_router_layout.mjs', () => {
  it('【protected】 /dashboard 自动加 meta.layout=app', () => {
    const input = `routes.push({ path: '/dashboard', component: X, meta: { requiresAuth: true } })`
    const out = runScript(input)
    expect(out).toMatch(/path:\s*['"]\/dashboard['"][\s\S]*?layout:\s*['"]app['"]/)
  })

  it('【public】 /login 自动加 meta.layout=auth', () => {
    const input = `routes.push({ path: '/login', component: X })`
    const out = runScript(input)
    expect(out).toMatch(/path:\s*['"]\/login['"][\s\S]*?layout:\s*['"]auth['"]/)
  })

  it('【保留】已设 layout 的不重复添加', () => {
    const input = `routes.push({ path: '/login', component: X, meta: { layout: 'auth' } })`
    const out = runScript(input)
    const matches = out.match(/layout:\s*['"]auth['"]/g) || []
    expect(matches.length).toBe(1)
  })

  it('【不动】未识别的 path (e.g. /api) 不动', () => {
    const input = `routes.push({ path: '/api/foo', component: X })`
    const out = runScript(input)
    expect(out).toBe(input)
  })
})

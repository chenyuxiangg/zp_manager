#!/usr/bin/env node
// PR0014 — 一次性 router meta.layout migration 工具
// 用法: node scripts/migrate_router_layout.mjs frontend/src/router/index.js
// 行为:
//   - protected route (/, /dashboard, /plans, /plans/:id, /tasks, /tasks/:id, /reports, /settings, /admin) → 补 layout: 'app'
//   - public route (/login, /register, /forgot-password, /reset-password) → 补 layout: 'auth'
//   - 已设 layout 的不动
//   - 未识别的 path 不动
// 退出码: 0 成功 / 1 文件不存在

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const FILE = process.argv[2]
if (!FILE) {
  console.error('用法: node migrate_router_layout.mjs <router-file>')
  process.exit(1)
}
const abs = resolve(FILE)
if (!existsSync(abs)) {
  console.error(`文件不存在: ${abs}`)
  process.exit(1)
}

const PROTECTED = [
  '/', '/dashboard', '/plans', '/plans/:id',
  '/tasks', '/tasks/:id', '/reports', '/settings', '/admin',
]
const PUBLIC = ['/login', '/register', '/forgot-password', '/reset-password']

let src = readFileSync(abs, 'utf-8')
let touched = 0

// 匹配 path: '/xxx' 后续到 meta / component / next
// 简化策略：直接对每个 known path 做字符串插入
for (const path of [...PROTECTED, ...PUBLIC]) {
  const layout = PROTECTED.includes(path) ? 'app' : 'auth'
  // 匹配 path 行
  const re = new RegExp(
    `(path:\\s*['"]${path.replace(/\//g, '\\/')}['"](?:\\s*,)?[\\s\\S]{0,200}?)(meta:\\s*\\{)`,
    'm'
  )
  // 已设 layout
  const hasLayout = new RegExp(
    `path:\\s*['"]${path.replace(/\//g, '\\/')}['"][\\s\\S]{0,300}?layout:\\s*['"]`,
    'm'
  ).test(src)
  if (hasLayout) continue

  if (re.test(src)) {
    src = src.replace(re, (_m, p1, p2) => {
      touched++
      return `${p1}meta: { layout: '${layout}', ${p2.replace('meta: {', '').trim() ? '' : ''}}`
    })
    // 实际写法：直接插入 layout 到 meta 内部
    // 上面正则替换不优雅，改用更直白的方式
  }
}

// 重写：更简单 — 对每个 known path，找到 path 行，向下扫描到 meta 块，插入 layout
function insertLayout(input, routePath, layout) {
  // 找 path
  const pathRe = new RegExp(`(\\bpath:\\s*['"]${routePath.replace(/\//g, '\\/')}['"])`, 'm')
  const pathMatch = input.match(pathRe)
  if (!pathMatch) return { out: input, changed: false }
  const afterPath = input.slice(pathMatch.index + pathMatch[0].length)

  // 找 meta: { ... }
  const metaRe = /meta:\s*\{/
  const metaMatch = afterPath.match(metaRe)
  if (!metaMatch) {
    // 没有 meta 块，插入一个
    return {
      out: input.slice(0, pathMatch.index) + pathMatch[0] + `, meta: { layout: '${layout}' }` + input.slice(pathMatch.index + pathMatch[0].length),
      changed: true,
    }
  }
  // 检查已有 layout
  const afterMeta = afterPath.slice(metaMatch.index + metaMatch[0].length, metaMatch.index + 200)
  if (/layout:\s*['"]/.test(afterMeta)) return { out: input, changed: false }
  // 插入 layout: 'xxx' 到 meta 块开头
  const insertPos = pathMatch.index + pathMatch[0].length + metaMatch.index + metaMatch[0].length
  return {
    out: input.slice(0, insertPos) + ` layout: '${layout}',` + input.slice(insertPos),
    changed: true,
  }
}

let finalSrc = src
// 重新从磁盘读，避免第一段 hack 污染
finalSrc = readFileSync(abs, 'utf-8')
let total = 0
for (const path of [...PROTECTED, ...PUBLIC]) {
  const layout = PROTECTED.includes(path) ? 'app' : 'auth'
  const { out, changed } = insertLayout(finalSrc, path, layout)
  if (changed) {
    finalSrc = out
    total++
  }
}

if (total === 0) {
  console.log('无需修改 (0 route 变更)')
} else {
  writeFileSync(abs, finalSrc)
  console.log(`✅ 迁移完成: ${total} 个 route 补 meta.layout`)
}

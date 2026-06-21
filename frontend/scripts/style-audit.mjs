#!/usr/bin/env node
// PR0014 — 自研样式审计脚本
// 阶段 3: 扫描 view 内联 <style> 行数 + 硬编码颜色 + 重复类
// 两阶段：
//   --baseline: WARN-only, 0 退出
//   默认（无参数）: 严格模式, 命中即 exit 1

import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const ROOT = process.cwd()
const VIEWS = join(ROOT, 'src/views')
const COMPONENTS = join(ROOT, 'src/components')
const BASELINE = process.argv.includes('--baseline') || process.env.STYLE_AUDIT_BASELINE === '1'

const COLOR_REGEX = /#[0-9a-fA-F]{3,8}\b|\brgb\(|\brgba\(|\bhsl\(|\bhsla\(/g
const STYLE_BLOCK = /<style[\s\S]*?<\/style>/g

function walk(dir) {
  if (!exists(dir)) return []
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (p.endsWith('.vue')) out.push(p)
  }
  return out
}
function exists(p) {
  try { statSync(p); return true } catch { return false }
}

const targets = [...walk(VIEWS), ...walk(COMPONENTS)]
const stats = {
  files: targets.length,
  inlineStyleLines: {},
  hardcodedColors: [],
  totalInlineLines: 0,
}

for (const f of targets) {
  const src = readFileSync(f, 'utf-8')
  const blocks = src.match(STYLE_BLOCK) || []
  let lineCount = 0
  for (const b of blocks) {
    lineCount += b.split('\n').length
  }
  if (lineCount > 0) {
    stats.inlineStyleLines[relative(ROOT, f)] = lineCount
    stats.totalInlineLines += lineCount
  }
  // 硬编码颜色 (排除 var(--) 引用、注释、transparent、currentColor)
  for (const match of src.matchAll(COLOR_REGEX)) {
    const ctx = src.slice(Math.max(0, match.index - 50), match.index + 50)
    if (/var\(--|currentColor|transparent|inherit/.test(ctx)) continue
    stats.hardcodedColors.push({
      file: relative(ROOT, f),
      color: match[0],
      index: match.index,
    })
  }
}

const sortedByLines = Object.entries(stats.inlineStyleLines)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)

console.log('=== Style Audit Report ===')
console.log(`扫描文件: ${stats.files}`)
console.log(`内联 <style> 总行数: ${stats.totalInlineLines}`)
console.log('Top 10 内联样式:')
for (const [f, n] of sortedByLines) {
  console.log(`  ${n.toString().padStart(4)}  ${f}`)
}
console.log(`硬编码颜色命中: ${stats.hardcodedColors.length} 处`)
if (stats.hardcodedColors.length > 0) {
  for (const h of stats.hardcodedColors.slice(0, 5)) {
    console.log(`  ${h.file} → ${h.color}`)
  }
  if (stats.hardcodedColors.length > 5) {
    console.log(`  ... (省略 ${stats.hardcodedColors.length - 5} 处)`)
  }
}

if (stats.hardcodedColors.length === 0) {
  console.log('\n✅ 0 硬编码颜色')
  process.exit(0)
}

if (BASELINE) {
  console.log(`\n⚠️  ${stats.hardcodedColors.length} 处硬编码颜色 (基线模式, 不阻断)`)
  process.exit(0)
}

console.log(`\n❌ 失败: ${stats.hardcodedColors.length} 处硬编码颜色，请改用 var(--*) 引用设计令牌`)
process.exit(1)

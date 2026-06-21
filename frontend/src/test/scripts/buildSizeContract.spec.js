// D0032 (B0318 R019) — build size contract test
// 目标: 跑 vite build 验证 entry chunk < 300KB, 单 chunk < 500KB, 4 个目标 chunk 独立存在
// 慢测试: 实际跑 build 约 6-7s, CI 可用 vitest --exclude 跳过
// B0318 原问题: entry 1.13MB 超 Vite 500KB 警告, 拆包后 entry 应 < 300KB

import { describe, it, expect, beforeAll } from 'vitest'
import { readdirSync, statSync, readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const DIST = join(process.cwd(), 'dist', 'assets')
const CHUNK_SIZE_LIMIT_KB = 500
const ENTRY_SIZE_LIMIT_KB = 300
const TOTAL_CSS_LIMIT_KB = 200

// 收集所有 .js / .css 文件大小 (kB)
function collectChunks() {
  const files = readdirSync(DIST)
  const chunks = []
  for (const f of files) {
    if (!f.endsWith('.js') && !f.endsWith('.css')) continue
    const size = statSync(join(DIST, f)).size
    chunks.push({ name: f, sizeKb: +(size / 1024).toFixed(2), ext: f.endsWith('.js') ? 'js' : 'css' })
  }
  return chunks
}

describe('D0032 build size contract', () => {
  let allChunks
  let jsChunks
  let cssChunks
  let entryChunk
  let targetChunks

  beforeAll(() => {
    // 跑一次 vite build (约 6-7s); --silent 减少 stdout 噪声
    execSync('npm run build', { cwd: process.cwd(), stdio: 'pipe' })
    allChunks = collectChunks()
    jsChunks = allChunks.filter((c) => c.ext === 'js')
    cssChunks = allChunks.filter((c) => c.ext === 'css')
    // entry chunk: 名字以 "index-" 开头 (无 view 名称前缀)
    entryChunk = jsChunks.find((c) => /^index-.*\.js$/.test(c.name))
    // 4 个目标 chunk: 名字前缀匹配
    targetChunks = {
      echarts: jsChunks.find((c) => c.name.startsWith('echarts-')),
      vueQuill: jsChunks.find((c) => c.name.startsWith('vue-quill-')),
      driver: jsChunks.find((c) => c.name.startsWith('driver-')),
      confetti: jsChunks.find((c) => c.name.startsWith('confetti-')),
    }
  }, 30000) // 30s timeout (build + collect)

  it('produces a non-null entry chunk', () => {
    expect(entryChunk).toBeTruthy()
    expect(entryChunk.name).toMatch(/^index-.*\.js$/)
  })

  it('entry chunk is below 300 kB (business code stripped of vendor)', () => {
    // B0318 原 entry 1132.39 kB; 拆包后业务代码应 < 300 kB
    expect(entryChunk.sizeKb).toBeLessThan(ENTRY_SIZE_LIMIT_KB)
  })

  it('every JS chunk is below Vite 500 kB warning threshold', () => {
    // 核心断言: 不再触发 "Some chunks are larger than 500 kB" 警告
    const oversize = jsChunks.filter((c) => c.sizeKb >= CHUNK_SIZE_LIMIT_KB)
    if (oversize.length > 0) {
      throw new Error(
        `Chunks over ${CHUNK_SIZE_LIMIT_KB} kB: ${oversize.map((c) => `${c.name}=${c.sizeKb} kB`).join(', ')}`
      )
    }
    expect(oversize).toHaveLength(0)
  })

  it('echarts is split into its own chunk', () => {
    expect(targetChunks.echarts).toBeTruthy()
    expect(targetChunks.echarts.name).toMatch(/^echarts-.*\.js$/)
  })

  it('@vueup/vue-quill is split into its own chunk', () => {
    expect(targetChunks.vueQuill).toBeTruthy()
    expect(targetChunks.vueQuill.name).toMatch(/^vue-quill-.*\.js$/)
  })

  it('driver.js is split into its own chunk', () => {
    expect(targetChunks.driver).toBeTruthy()
    expect(targetChunks.driver.name).toMatch(/^driver-.*\.js$/)
  })

  it('canvas-confetti is split into its own chunk', () => {
    expect(targetChunks.confetti).toBeTruthy()
    expect(targetChunks.confetti.name).toMatch(/^confetti-.*\.js$/)
  })

  it('total CSS payload is below 200 kB (gzip-uncompressed)', () => {
    const totalCssKb = cssChunks.reduce((sum, c) => sum + c.sizeKb, 0)
    expect(totalCssKb).toBeLessThan(TOTAL_CSS_LIMIT_KB)
  })
})

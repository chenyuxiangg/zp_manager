// D0032 (B0318 R019) — vite.config.js manualChunks 配置 contract test
// 目标: 守护 manualChunks 函数存在并覆盖 4 个目标包 + 兜底 chunk
// 不跑 build，纯静态分析 vite.config.js 源码（快速 feedback）

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const VITE_CONFIG = join(process.cwd(), 'vite.config.js')

describe('D0032 vite.config.js manualChunks contract', () => {
  const src = readFileSync(VITE_CONFIG, 'utf-8')

  it('configures build.rollupOptions.output.manualChunks', () => {
    expect(src).toMatch(/manualChunks/)
  })

  it('manualChunks function splits echarts into its own chunk', () => {
    expect(src).toMatch(/id\.includes\(['"]echarts['"]\)/)
    expect(src).toMatch(/return\s+['"]echarts['"]/)
  })

  it('manualChunks function splits @vueup/vue-quill into its own chunk', () => {
    expect(src).toMatch(/@vueup\/vue-quill/)
    expect(src).toMatch(/return\s+['"]vue-quill['"]/)
  })

  it('manualChunks function splits driver.js into its own chunk', () => {
    expect(src).toMatch(/driver\.js/)
    expect(src).toMatch(/return\s+['"]driver['"]/)
  })

  it('manualChunks function splits canvas-confetti into its own chunk', () => {
    expect(src).toMatch(/canvas-confetti/)
    expect(src).toMatch(/return\s+['"]confetti['"]/)
  })

  it('manualChunks function provides a vendor fallback chunk', () => {
    // 兜底: 任何 node_modules 下未匹配 4 个目标包的内容进 vendor
    expect(src).toMatch(/return\s+['"]vendor['"]/)
  })

  it('does not disable chunking via inlineDynamicImports or similar', () => {
    // 反向守护: 防止后续有人手贱把 manualChunks 拆出来后又用 inline 关掉
    expect(src).not.toMatch(/inlineDynamicImports/)
    expect(src).not.toMatch(/output\.inlineAssets/)
  })
})

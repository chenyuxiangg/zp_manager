// B0285 — PasswordInput SVG 应加 stroke-linecap="round" 防止线段端点锯齿
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SOURCE = readFileSync(resolve(__dirname, '../../components/common/PasswordInput.vue'), 'utf-8')

describe('【B0285 PasswordInput SVG 端点圆滑】', () => {
  it('第一个 <svg> 含 stroke-linecap="round"', () => {
    const firstSvg = SOURCE.match(/<svg\b[^>]*>/)
    expect(firstSvg).not.toBeNull()
    expect(firstSvg[0]).toMatch(/stroke-linecap="round"/)
  })

  it('第二个 <svg> (v-else) 含 stroke-linecap="round"', () => {
    const svgs = [...SOURCE.matchAll(/<svg\b[^>]*>/g)]
    expect(svgs.length).toBeGreaterThanOrEqual(2)
    expect(svgs[1][0]).toMatch(/stroke-linecap="round"/)
  })

  it('两个 <svg> 都含 stroke-linejoin="round" (圆滑拐角)', () => {
    const svgs = [...SOURCE.matchAll(/<svg\b[^>]*>/g)]
    for (const m of svgs) {
      expect(m[0]).toMatch(/stroke-linejoin="round"/)
    }
  })
})
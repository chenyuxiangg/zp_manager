// B0292 — sanitizeHtml 单元测试（深度防御 XSS）
// 后端已用 bleach sanitize (RR1)，前端再加一道防御性 strip
import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '@/utils/sanitize'

describe('sanitizeHtml', () => {
  describe('空与无效输入', () => {
    it('null 返回空字符串', () => {
      expect(sanitizeHtml(null)).toBe('')
    })
    it('undefined 返回空字符串', () => {
      expect(sanitizeHtml(undefined)).toBe('')
    })
    it('空字符串返回空字符串', () => {
      expect(sanitizeHtml('')).toBe('')
    })
    it('非字符串返回空字符串', () => {
      expect(sanitizeHtml(123)).toBe('')
      expect(sanitizeHtml({})).toBe('')
      expect(sanitizeHtml([])).toBe('')
    })
  })

  describe('【strip script】 移除 <script>', () => {
    it('移除简单 script 标签', () => {
      const malicious = '<p>hi</p><script>alert(1)</script>'
      expect(sanitizeHtml(malicious)).not.toContain('<script')
      expect(sanitizeHtml(malicious)).not.toContain('alert(1)')
    })
    it('移除带 src 属性的 script', () => {
      const malicious = '<script src="evil.js"></script>'
      expect(sanitizeHtml(malicious)).not.toContain('<script')
    })
    it('移除多 script 标签', () => {
      const malicious = '<script>a</script><p>ok</p><script>b</script>'
      const out = sanitizeHtml(malicious)
      expect(out).not.toContain('<script')
      expect(out).toContain('<p>ok</p>')
    })
  })

  describe('【strip dangerous tags】 移除 iframe/object/embed/form/input/style/link/meta', () => {
    it('移除 iframe', () => {
      const out = sanitizeHtml('<iframe src="x"></iframe><p>ok</p>')
      expect(out).not.toContain('<iframe')
      expect(out).toContain('<p>ok</p>')
    })
    it('移除 object', () => {
      const out = sanitizeHtml('<object data="x"></object>')
      expect(out).not.toContain('<object')
    })
    it('移除 embed', () => {
      const out = sanitizeHtml('<embed src="x">')
      expect(out).not.toContain('<embed')
    })
    it('移除 form / input', () => {
      const out = sanitizeHtml('<form><input type="text"></form>')
      expect(out).not.toContain('<form')
      expect(out).not.toContain('<input')
    })
    it('移除 style / link / meta', () => {
      const out = sanitizeHtml('<style>body{}</style><link rel="stylesheet"><meta charset="utf-8">')
      expect(out).not.toContain('<style')
      expect(out).not.toContain('<link')
      expect(out).not.toContain('<meta')
    })
  })

  describe('【strip on*】 移除事件处理器', () => {
    it('移除 onclick', () => {
      const out = sanitizeHtml('<p onclick="alert(1)">x</p>')
      expect(out).not.toMatch(/onclick/i)
    })
    it('移除 onerror', () => {
      const out = sanitizeHtml('<img src="x" onerror="alert(1)">')
      expect(out).not.toMatch(/onerror/i)
    })
    it('移除 onmouseover', () => {
      const out = sanitizeHtml('<a onmouseover="alert(1)">x</a>')
      expect(out).not.toMatch(/onmouseover/i)
    })
  })

  describe('【strip javascript: 协议】', () => {
    it('移除 href="javascript:..."', () => {
      const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>')
      expect(out).not.toMatch(/javascript:/i)
    })
    it('移除 src="javascript:..."', () => {
      const out = sanitizeHtml('<img src="javascript:alert(1)">')
      expect(out).not.toMatch(/javascript:/i)
    })
  })

  describe('【保留白名单】', () => {
    it('保留 p / strong / em / u / s / code / pre / blockquote', () => {
      const out = sanitizeHtml('<p>hi <strong>bold</strong> <em>em</em> <code>c</code></p>')
      expect(out).toContain('<p>')
      expect(out).toContain('<strong>')
      expect(out).toContain('<em>')
      expect(out).toContain('<code>')
    })
    it('保留 ul / ol / li', () => {
      const out = sanitizeHtml('<ul><li>a</li><li>b</li></ul>')
      expect(out).toContain('<ul>')
      expect(out).toContain('<li>')
    })
    it('保留 a[href] 但过滤 on* / javascript:', () => {
      const out = sanitizeHtml('<a href="https://x.com" onclick="x">link</a>')
      expect(out).toContain('href="https://x.com"')
      expect(out).not.toMatch(/onclick/i)
    })
    it('保留 img[src, alt]', () => {
      const out = sanitizeHtml('<img src="a.png" alt="img" onclick="x">')
      expect(out).toContain('<img')
      expect(out).toContain('src="a.png"')
      expect(out).toContain('alt="img"')
      expect(out).not.toMatch(/onclick/i)
    })
  })

  describe('【综合】典型 XSS 攻击载荷', () => {
    it('防御 img onerror', () => {
      const malicious = '<img src=x onerror=alert(1)>'
      const out = sanitizeHtml(malicious)
      expect(out).not.toMatch(/onerror/i)
      expect(out).not.toMatch(/alert\(1\)/)
    })
    it('防御 svg onload', () => {
      const malicious = '<svg onload=alert(1)>'
      const out = sanitizeHtml(malicious)
      expect(out).not.toMatch(/onload/i)
    })
    it('防御 mixed-case script', () => {
      const malicious = '<ScRiPt>alert(1)</ScRiPt>'
      const out = sanitizeHtml(malicious)
      expect(out.toLowerCase()).not.toContain('<script')
    })
  })
})
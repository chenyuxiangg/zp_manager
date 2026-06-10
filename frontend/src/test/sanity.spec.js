// Sanity 测试：验证 vitest 基建正常工作
import { describe, it, expect } from 'vitest'

describe('test infrastructure', () => {
  it('runs basic assertions', () => {
    expect(1 + 1).toBe(2)
  })

  it('supports async tests', async () => {
    const value = await Promise.resolve(42)
    expect(value).toBe(42)
  })

  it('has access to globals (describe/it/expect)', () => {
    expect(typeof describe).toBe('function')
    expect(typeof it).toBe('function')
    expect(typeof expect).toBe('function')
  })

  it('has access to localStorage in happy-dom', () => {
    localStorage.setItem('test', 'value')
    expect(localStorage.getItem('test')).toBe('value')
  })

  it('has VITE_USE_MOCK stubbed to true', () => {
    expect(import.meta.env.VITE_USE_MOCK).toBe('true')
  })
})

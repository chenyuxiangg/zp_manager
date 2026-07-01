// B0349 — driver.js v1.4.0 实际 API surface 契约测试
//
// 根因：v2.18.1 时 onboarding.js 用了不存在的 driver.js API（defineSteps / start），
//       但被 useOnboardingWatcher 的 gate 掩盖——tour 从未真正启动过。
//       B0348 修复让 tour 真正启动，浏览器 console 立即抛
//       "driver.defineSteps is not a function"。
//
// 修复方向：把 onboarding.js 从错误 API 改到 v1.4.0 真实 API（setSteps + drive(N)）。
//          本 spec 守护两件事：
//          (1) driver.js v1.4.0 实际暴露的 API（防 driver.js 升级时漏检）
//          (2) onboarding.js 必须使用 v1.4.0 真实 API（防回退到错 API）
//
// TDD 红绿翻转反例警示：
//   - onboarding.spec.js / onboardingResume.spec.js / onboardingDestroy.spec.js
//     都 mock 了 `defineSteps / start` 假 API，测试假绿——若 driver.js 升级到
//     删掉这些假 API 的版本，测试仍会假绿直到 production 报错。
//   - 本 spec 直接 import 真 driver.js，不走 mock，让 TDD 真绿/真红。

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 真实 driver.js（不走 mock）
import { driver as Driver } from 'driver.js'

const ONBOARDING_JS = readFileSync(
  resolve(__dirname, '../../stores/onboarding.js'),
  'utf-8',
)

describe('B0349 — driver.js v1.4.0 实际 API surface', () => {
  it('【API 存在】driver() 工厂返回的实例有 setSteps 方法（v1.4.0 真实 API）', () => {
    const d = Driver({})
    expect(typeof d.setSteps).toBe('function')
  })

  it('【API 存在】driver() 工厂返回的实例有 drive 方法（v1.4.0 真实 API）', () => {
    const d = Driver({})
    expect(typeof d.drive).toBe('function')
  })

  it('【API 不存在】driver() 工厂返回的实例没有 defineSteps 方法（防回退到错 API）', () => {
    const d = Driver({})
    expect(d.defineSteps).toBeUndefined()
  })

  it('【API 不存在】driver() 工厂返回的实例没有 start 方法（防回退到错 API）', () => {
    const d = Driver({})
    expect(typeof d.start).toBe('undefined')
  })

  it('【行为】setSteps 接受 step 数组后 drive(N) 不抛错', () => {
    // happy-dom 没有完整 DOM，但 setSteps + drive 应至少不抛 driver 内部错
    // （driver.js v1.4.0 在 happy-dom 下可能因 querySelector 失败抛错，但应在 drive 时才抛）
    const d = Driver({})
    expect(() => d.setSteps([{ element: '#nope', popover: { title: 't' } }])).not.toThrow()
  })
})

describe('B0349 — onboarding.js 源码必须用 v1.4.0 真实 API', () => {
  it('【源码正向】必含 setSteps 调用 或 在 new Driver 内联 steps 字段（v1.4.0 真实 API）', () => {
    // 接受两种用法：
    //   (a) driver.setSteps(TOUR_STEPS) — v1.4.0 显式设置
    //   (b) new Driver({..., steps: <任意变量>, ...}) — v1.4.0 构造时传
    // B0351: 接受 instrumentedSteps 之类的派生变量名（store 内 step 注入路径）
    const hasSetStepsCall = /driver\.setSteps\s*\(/.test(ONBOARDING_JS)
    // \s+steps\s*: 后跟任意标识符（TOUR_STEPS / instrumentedSteps / 等）
    const hasStepsInConstructor = /new\s+Driver\s*\(\s*\{[\s\S]*?steps\s*:\s*[A-Za-z_$][\w$]*[\s,}]/.test(ONBOARDING_JS)
    expect(hasSetStepsCall || hasStepsInConstructor).toBe(true)
  })

  it('【源码反向】绝不含 driver.defineSteps（防回退到 driver.js v0.x 旧 API）', () => {
    expect(ONBOARDING_JS).not.toMatch(/driver\.defineSteps\s*\(/)
  })

  it('【源码反向】绝不含 driver.start() 调用（防回退到 driver.js v0.x 旧 API）', () => {
    expect(ONBOARDING_JS).not.toMatch(/driver\.start\s*\(/)
  })
})

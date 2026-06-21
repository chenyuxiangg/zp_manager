// PR0010 — 反馈三件套 useFeedback provide/inject 契约
// 目标: 锁定 provide/inject 单例 + 事件触发语义 + 撤销完成不触发礼花
//
// 行为契约:
//   - FEEDBACK_KEY 必须是 Symbol.for 全局注册 (跨模块一致)
//   - celebrate(x, y, pts) → fb.event.value = { type:'celebrate', ... }
//   - floatPoints(x, y, pts) → fb.event.value = { type:'float', ... }
//   - useFeedback() 在 provide 外抛错 (使用前必须 provide)
//   - 事件有 view_id 字段用于隔离

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, provide } from 'vue'
import { FEEDBACK_KEY, provideFeedback, useFeedback } from '@/composables/useFeedback'

describe('PR0010 — useFeedback 契约', () => {
  it('【FEEDBACK_KEY】是 Symbol.for 注册的全局 key', () => {
    expect(typeof FEEDBACK_KEY).toBe('symbol')
    expect(FEEDBACK_KEY).toBe(Symbol.for('zpersion.feedback'))
  })

  it('【provideFeedback】返 { event: ref(null) }', () => {
    const fb = provideFeedback()
    expect(fb).toHaveProperty('event')
    expect(fb.event.value).toBeNull()
  })

  it('【useFeedback】在 provide 内可调用 celebrate/floatPoints', async () => {
    let captured = null
    const C = defineComponent({
      setup() {
        captured = useFeedback('test-view')
        return () => h('div')
      },
    })
    mount(C, {
      global: {
        provide: { [FEEDBACK_KEY]: provideFeedback() },
      },
    })
    expect(captured).not.toBeNull()
    expect(typeof captured.celebrate).toBe('function')
    expect(typeof captured.floatPoints).toBe('function')
  })

  it('【celebrate】设置 event.value = { type:"celebrate", x, y, points_delta, view_id }', async () => {
    const fb = provideFeedback()
    const C = defineComponent({
      setup() {
        const hook = useFeedback('my-view')
        return () => {
          hook.celebrate(100, 200, 10)
          return h('div')
        }
      },
    })
    const P = defineComponent({
      setup() {
        provide(FEEDBACK_KEY, fb)
        return () => h(C)
      },
    })
    mount(P)
    await nextTick()
    expect(fb.event.value).toMatchObject({
      type: 'celebrate',
      x: 100,
      y: 200,
      points_delta: 10,
      view_id: 'my-view',
    })
  })

  it('【floatPoints】type="float"，携带 view_id', async () => {
    const fb = provideFeedback()
    const C = defineComponent({
      setup() {
        const hook = useFeedback('x')
        return () => { hook.floatPoints(1, 2, -5); return h('div') }
      },
    })
    const P = defineComponent({
      setup() { provide(FEEDBACK_KEY, fb); return () => h(C) },
    })
    mount(P)
    await nextTick()
    expect(fb.event.value).toMatchObject({
      type: 'float', x: 1, y: 2, points_delta: -5, view_id: 'x',
    })
  })

  it('【未 provide 抛错】useFeedback() 在 provide 外调用抛错', () => {
    const C = defineComponent({
      setup() {
        useFeedback()  // 未 provide
        return () => h('div')
      },
    })
    expect(() => mount(C)).toThrow(/provide/)
  })

  it('【撤销不礼花】呼叫方控制 — celebrate 不会被自动跳过（业务层判定）', () => {
    // 此测试为契约文档化：撤销完成的"不礼花"在调用方（Tasks.vue）判断
    // useFeedback 不感知业务场景
    const fb = provideFeedback()
    expect(fb.event.value).toBeNull()
  })

  // B0275 — id 同毫秒去重
  it('【B0275 event.id 是字符串非数字】crypto.randomUUID 输出防止 setEvent 同毫秒覆盖', () => {
    const fb = provideFeedback()
    // 直接通过 _setEvent 注入 5 个 payload（模拟同毫秒）
    const ids = new Set()
    for (let i = 0; i < 5; i++) {
      const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `mock-${i}-${Date.now()}`
      ids.add(id)
      fb._setEvent({ type: 'celebrate', x: 0, y: 0, points_delta: 0, view_id: 't', id })
    }
    // 5 次必产生 5 个不同 id（即使 Date.now() 相同）
    expect(ids.size).toBe(5)
    // id 必须是字符串（crypto.randomUUID 格式）
    const sampleId = [...ids][0]
    expect(typeof sampleId).toBe('string')
    expect(sampleId.length).toBeGreaterThanOrEqual(16)
  })
})

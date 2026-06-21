// PR0010 — 反馈三件套 useFeedback provide/inject 跨组件通信
// 用法:
//   App.vue:    const fb = provideFeedback(); provide(FEEDBACK_KEY, fb)
//   任何 view:  const { celebrate, floatPoints } = useFeedback('view-id')
// 业务层判定：撤销完成不调 celebrate() 即可，useFeedback 不感知业务
// 契约 (test/composables/useFeedback.spec.js 守护):
//   - FEEDBACK_KEY 用 Symbol.for 全局注册 (跨模块一致)
//   - celebrate/floatPoints 设置 fb.event.value
//   - 未 provide 时 inject 抛错

import { ref, inject, nextTick } from 'vue'

export const FEEDBACK_KEY = Symbol.for('zpersion.feedback')

export function provideFeedback() {
  const event = ref(null)
  // B0259: 闭包内 per-instance 队列 (避免多 view 并发 setEvent 串扰)
  let queued = null
  function setEvent(payload) {
    queued = payload
    nextTick(() => {
      if (queued) {
        event.value = queued
        queued = null
      }
    })
  }
  return { event, _setEvent: setEvent }
}

export function useFeedback(viewId = 'global') {
  const fb = inject(FEEDBACK_KEY)
  if (!fb) {
    throw new Error('useFeedback must be used within provideFeedback() — wrap App.vue setup with provide(FEEDBACK_KEY, fb)')
  }
  // B0275: id 改用 crypto.randomUUID 避免同毫秒冲突
  const newId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
  return {
    celebrate(x, y, points) {
      fb._setEvent({
        type: 'celebrate',
        x, y,
        points_delta: points,
        view_id: viewId,
        id: newId(),
      })
    },
    floatPoints(x, y, points) {
      fb._setEvent({
        type: 'float',
        x, y,
        points_delta: points,
        view_id: viewId,
        id: newId(),
      })
    },
  }
}

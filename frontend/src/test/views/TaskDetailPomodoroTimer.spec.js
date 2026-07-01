// B0344 — TaskDetail.vue PomodoroTimer props 契约
//
// 修复要点（必须守护）：
// 1. TaskDetail.vue 必须 import + 实例化 useCountdown（驱动倒计时）
// 2. startPomodoro 成功后调 startCountdown(ms)
// 3. stopPomodoro 调 stopCountdown()
// 4. PomodoroTimer 模板必须传 :remaining / :running / :completed（不是 :duration / :auto-toggle）
// 5. 反向守护：模板不能残留 :duration= / :auto-toggle= / @complete=

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const TASK_DETAIL_VUE = readFileSync(
  join(__dirname, '../../../src/views/TaskDetail.vue'),
  'utf-8',
)

describe('B0344 — TaskDetail.vue useCountdown wiring（源码守护）', () => {
  it('【import useCountdown】源码含 useCountdown import', () => {
    expect(TASK_DETAIL_VUE).toMatch(/import\s+\{\s*useCountdown\s*\}\s+from\s+['"]@\/composables\/useCountdown['"]/)
  })

  it('【useCountdown 调用】源码含 useCountdown() 实例化', () => {
    expect(TASK_DETAIL_VUE).toMatch(/useCountdown\(/)
  })

  it('【startPomodoro 启动倒计时】源码含 startCountdown 调用', () => {
    // 守护：start 路径必须 startCountdown(ms)，否则 PomodoroTimer 永远显示 0/NaN
    expect(TASK_DETAIL_VUE).toMatch(/startCountdown\(/)
  })

  it('【stopPomodoro 停止倒计时】源码含 stopCountdown 调用', () => {
    // 守护：stop 路径必须 stopCountdown()，否则离开 TaskDetail 页面 timer 不清
    expect(TASK_DETAIL_VUE).toMatch(/stopCountdown\(/)
  })
})

describe('B0344 — PomodoroTimer 模板 props（源码守护）', () => {
  it('【PomodoroTimer】模板必须传 :remaining', () => {
    // 修复后契约：PomodoroTimer 是纯展示组件，只读 remaining prop（之前的 :duration 是错的，导致 NaN:NaN）
    expect(TASK_DETAIL_VUE).toMatch(/<PomodoroTimer[\s\S]*?:remaining=/)
  })

  it('【PomodoroTimer】模板必须传 :running', () => {
    expect(TASK_DETAIL_VUE).toMatch(/<PomodoroTimer[\s\S]*?:running=/)
  })

  it('【PomodoroTimer】模板必须传 :completed', () => {
    expect(TASK_DETAIL_VUE).toMatch(/<PomodoroTimer[\s\S]*?:completed=/)
  })

  it('【PomodoroTimer 反向守护】不能再传 :duration（PomodoroTimer 没有此 prop）', () => {
    // 反向：阻止有人改回 :duration 触发 NaN:NaN
    const timerBlock = TASK_DETAIL_VUE.match(/<PomodoroTimer[\s\S]*?\/>/)?.[0] || ''
    expect(timerBlock).not.toMatch(/:duration=/)
  })

  it('【PomodoroTimer 反向守护】不能再传 :auto-toggle（PomodoroTimer 没有此 prop）', () => {
    const timerBlock = TASK_DETAIL_VUE.match(/<PomodoroTimer[\s\S]*?\/>/)?.[0] || ''
    expect(timerBlock).not.toMatch(/:auto-toggle=/)
  })

  it('【PomodoroTimer 反向守护】不能再监听 @complete（onComplete 改由 useCountdown 回调）', () => {
    const timerBlock = TASK_DETAIL_VUE.match(/<PomodoroTimer[\s\S]*?\/>/)?.[0] || ''
    expect(timerBlock).not.toMatch(/@complete=/)
  })
})
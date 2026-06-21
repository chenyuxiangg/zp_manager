// PR0021 — Pomodoro 3 组件冒烟测试
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'

describe('PR0021 — Pomodoro 组件契约', () => {
  it('【PomodoroTimer】mm:ss 格式', async () => {
    const { default: PomodoroTimer } = await import('@/components/pomodoro/PomodoroTimer.vue')
    const w = mount(PomodoroTimer, { props: { remaining: 125, running: true } })
    expect(w.find('.pomodoro-timer__time').text()).toBe('02:05')
    expect(w.classes()).toContain('is-running')
  })

  it('【PomodoroTimer】completed 状态文案', async () => {
    const { default: PomodoroTimer } = await import('@/components/pomodoro/PomodoroTimer.vue')
    const w = mount(PomodoroTimer, { props: { remaining: 0, completed: true } })
    expect(w.text()).toContain('专注完成')
    expect(w.classes()).toContain('is-completed')
  })

  it('【PomodoroStartButton】未运行 → "开始"；运行中 → "结束"', async () => {
    const { default: PomodoroStartButton } = await import('@/components/pomodoro/PomodoroStartButton.vue')
    const idle = mount(PomodoroStartButton, { props: { running: false } })
    expect(idle.text()).toBe('开始专注')
    const running = mount(PomodoroStartButton, { props: { running: true } })
    expect(running.text()).toBe('结束专注')
  })

  it('【PomodoroStartButton】点击 emit start/stop', async () => {
    const { default: PomodoroStartButton } = await import('@/components/pomodoro/PomodoroStartButton.vue')
    const idle = mount(PomodoroStartButton, { props: { running: false } })
    await idle.find('button').trigger('click')
    expect(idle.emitted('start')).toBeTruthy()
    const running = mount(PomodoroStartButton, { props: { running: true } })
    await running.find('button').trigger('click')
    expect(running.emitted('stop')).toBeTruthy()
  })

  it('【PomodoroHistoryList】空态文案', async () => {
    const { default: PomodoroHistoryList } = await import('@/components/pomodoro/PomodoroHistoryList.vue')
    const w = mount(PomodoroHistoryList, { props: { sessions: [] } })
    expect(w.text()).toContain('暂无专注记录')
  })

  it('【PomodoroHistoryList】有数据 → 渲染 list', async () => {
    const { default: PomodoroHistoryList } = await import('@/components/pomodoro/PomodoroHistoryList.vue')
    const w = mount(PomodoroHistoryList, {
      props: {
        // B0314: 改字段名为 actual_seconds + planned_minutes（与真后端/mock 契约一致）
        sessions: [
          { id: 1, started_at: '2026-06-17T10:00:00Z', actual_seconds: 1500, planned_minutes: 25, completed: true },
        ],
      },
    })
    expect(w.findAll('.pomodoro-history__item').length).toBe(1)
    expect(w.text()).toContain('完成')
    expect(w.text()).toContain('25 分钟')
  })
})

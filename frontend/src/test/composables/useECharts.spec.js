// PR0007 — 报表可视化 useECharts composable
// 目标: 锁定 5 个行为契约
//   1) shallowRef 包装 echarts 实例
//   2) initChart(dom, option) 构造实例 + setOption
//   3) resize() 触发实例 resize
//   4) dispose() 在 unmount/cleanup 时调用
//   5) isMobile() 返回 window.innerWidth < 768 (用于移动端降级)

import { describe, it, expect, vi, beforeEach } from 'vitest'

// mock echarts (避免真实渲染)
const setOptionMock = vi.fn()
const resizeMock = vi.fn()
const disposeMock = vi.fn()
const echartsInstance = {
  setOption: setOptionMock,
  resize: resizeMock,
  dispose: disposeMock,
}
const initMock = vi.fn(() => echartsInstance)
const echartsMock = { init: initMock }
vi.mock('echarts/core', () => echartsMock)

describe('PR0007 — useECharts 契约', () => {
  beforeEach(() => {
    initMock.mockClear()
    setOptionMock.mockReset()
    resizeMock.mockReset()
    disposeMock.mockReset()
  })

  it('【initChart】调用 echarts.init + setOption', async () => {
    const { useECharts } = await import('@/composables/useECharts')
    const { chart, initChart } = useECharts()
    const dom = document.createElement('div')
    await initChart(dom, { xAxis: {}, yAxis: {} }, { echarts: echartsMock })
    expect(initMock).toHaveBeenCalledTimes(1)
    expect(setOptionMock).toHaveBeenCalledTimes(1)
    expect(chart.value).toBe(echartsInstance)
  })

  it('【resize】转发到 echarts.resize', async () => {
    const { useECharts } = await import('@/composables/useECharts')
    const { initChart, resize } = useECharts()
    const dom = document.createElement('div')
    await initChart(dom, {}, { echarts: echartsMock })
    resize()
    expect(resizeMock).toHaveBeenCalledTimes(1)
  })

  it('【dispose】销毁实例 + 清空 ref', async () => {
    const { useECharts } = await import('@/composables/useECharts')
    const { chart, initChart, dispose } = useECharts()
    const dom = document.createElement('div')
    await initChart(dom, {}, { echarts: echartsMock })
    expect(chart.value).toBeTruthy()
    dispose()
    expect(disposeMock).toHaveBeenCalledTimes(1)
    expect(chart.value).toBeNull()
  })

  it('【多次 init】dispose 旧实例后再 init', async () => {
    const { useECharts } = await import('@/composables/useECharts')
    const { initChart } = useECharts()
    const dom1 = document.createElement('div')
    const dom2 = document.createElement('div')
    await initChart(dom1, {}, { echarts: echartsMock })
    await initChart(dom2, {}, { echarts: echartsMock })
    expect(disposeMock).toHaveBeenCalledTimes(1)  // 第一次的实例被 dispose
    expect(initMock).toHaveBeenCalledTimes(2)
  })

  it('【isMobile】< 768 视口 → true (移动端降级用)', async () => {
    const { isMobile } = await import('@/composables/useECharts')
    window.innerWidth = 500
    expect(isMobile()).toBe(true)
    window.innerWidth = 1024
    expect(isMobile()).toBe(false)
  })

  it('【option 更新】setOption 重新调用', async () => {
    const { useECharts } = await import('@/composables/useECharts')
    const { initChart, setOption } = useECharts()
    const dom = document.createElement('div')
    await initChart(dom, { series: [{ data: [1] }] }, { echarts: echartsMock })
    setOption({ series: [{ data: [2] }] })
    expect(setOptionMock).toHaveBeenCalledTimes(2)
  })
})

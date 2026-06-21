// PR0007 — 报表可视化 useECharts composable
// 行为契约 (test/composables/useECharts.spec.js 守护):
//   - initChart(dom, option) → echarts.init + setOption  (deps.echarts 可选)
//   - resize() / dispose() / setOption() 转发
//   - 多次 init 先 dispose 旧实例
//   - isMobile() < 768 true (移动端降级)
//
// B0301 Q2: 默认从 '@/composables/echartsCore' 取 echarts 实例 (避免每个调用方注入)

import { shallowRef } from 'vue'

export function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < 768
}

export function useECharts() {
  const chart = shallowRef(null)
  let echartsLib = null

  async function initChart(dom, option, deps = {}) {
    if (chart.value) {
      try { chart.value.dispose() } catch { /* ignore */ }
      chart.value = null
    }
    echartsLib = deps.echarts || echartsLib
    if (!echartsLib) {
      // Q2: 默认 fallback 到 echartsCore (main.js 已注册 LineChart/BarChart/Heatmap)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/composables/echartsCore')
      echartsLib = mod.echarts
    }
    if (!echartsLib) {
      throw new Error('useECharts: echarts runtime 未注入；请检查 main.js 是否 import "@/composables/echartsCore"')
    }
    const instance = echartsLib.init(dom)
    instance.setOption(option)
    chart.value = instance
  }

  function setOption(option) {
    if (chart.value) chart.value.setOption(option)
  }

  function resize() {
    if (chart.value) chart.value.resize()
  }

  function dispose() {
    if (chart.value) {
      try { chart.value.dispose() } catch { /* ignore */ }
      chart.value = null
    }
  }

  return { chart, initChart, setOption, resize, dispose }
}
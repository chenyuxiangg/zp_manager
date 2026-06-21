<template>
  <div ref="chartRef" class="trend-line-chart" :style="{ height: height + 'px' }">
    <p v-if="!hasData" class="trend-line-chart__empty">暂无数据</p>
  </div>
</template>

<script setup>
// B0250 — 趋势线图
// 依赖从 props.echarts 注入 (避免 Vite 静态分析); 未注入时显示空
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useECharts, isMobile } from '@/composables/useECharts'

const props = defineProps({
  series: { type: Array, default: () => [] },
  height: { type: Number, default: 300 },
  echarts: { type: Object, default: null },  // 注入: import('echarts/core')
})

const chartRef = ref(null)
const { initChart, dispose, resize } = useECharts()
const hasData = ref(props.series.length > 0)

async function buildChart() {
  if (isMobile() || !chartRef.value || !props.echarts) return
  const option = {
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: { type: 'category', data: props.series[0]?.data.map(d => d.date) || [] },
    yAxis: { type: 'value' },
    series: props.series.map(s => ({
      name: s.name, type: 'line', smooth: true, data: s.data.map(d => d.value),
    })),
    tooltip: { trigger: 'axis' },
  }
  await initChart(chartRef.value, option, { echarts: props.echarts })
}

onMounted(() => {
  buildChart()
  window.addEventListener('resize', resize)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  dispose()
})
watch(() => props.series, () => { if (hasData.value) buildChart() }, { deep: true })
</script>

<style scoped>
.trend-line-chart { width: 100%; min-height: 200px; }
.trend-line-chart__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
}
</style>

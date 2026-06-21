<template>
  <div ref="chartRef" class="completion-heatmap" :style="{ height: height + 'px' }">
    <p v-if="!hasData" class="completion-heatmap__empty">暂无数据</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useECharts, isMobile } from '@/composables/useECharts'

const props = defineProps({
  data: { type: Array, default: () => [] },
  height: { type: Number, default: 200 },
  echarts: { type: Object, default: null },
  // B0322 修复：年报时指定 year → calendar range 覆盖全年（默认 null 时回退到首日所在月）
  year: { type: Number, default: null },
})

const chartRef = ref(null)
const { initChart, dispose, resize } = useECharts()
const hasData = ref(props.data.length > 0)

async function buildChart() {
  if (isMobile() || !chartRef.value || !props.echarts) return
  // B0322: 指定 year 时 calendar range = `${year}`（全年），否则回退到首日所在月（兼容周/月报）
  const range = props.year
    ? `${props.year}`
    : (props.data[0]?.date || '2026-01')
  const option = {
    visualMap: { min: 0, max: 10, calculable: true, orient: 'horizontal', left: 'center' },
    calendar: { top: 30, left: 30, right: 30, range },
    series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: props.data.map(d => [d.date, d.count]) }],
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
watch(() => props.data, () => { if (hasData.value) buildChart() }, { deep: true })
</script>

<style scoped>
.completion-heatmap { width: 100%; min-height: 150px; }
.completion-heatmap__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-secondary);
}
</style>

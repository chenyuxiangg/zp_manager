// PR0007 — ECharts runtime 注册 (按 Q2 决策: 只装 echarts, 不装 vue-echarts)
// 在 main.js 顶层 import 一次,所有 useECharts 调用方通过 deps.echarts 拿到实例
// 选最小集: LineChart + BarChart + HeatmapChart + GridComponent + TooltipComponent + CanvasRenderer

import * as echarts from 'echarts/core'
import { LineChart, BarChart, HeatmapChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  VisualMapComponent,
  DataZoomComponent,
  CalendarComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  LineChart,
  BarChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  VisualMapComponent,
  DataZoomComponent,
  CalendarComponent,
  CanvasRenderer,
])

export { echarts }
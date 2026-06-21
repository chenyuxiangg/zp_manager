// B0322 — Reports.vue + CompletionHeatmap.vue yearly-heatmap 接入 contract test
//
// 修复要点（必须守护）：
// 1. Reports.vue 年报时调 reportsStore.fetchYearlyHeatmap
// 2. Reports.vue 模板：reportType==='yearly' 时 CompletionHeatmap 接收 yearlyHeatmap + year prop
// 3. CompletionHeatmap.vue 加 year prop + 用 props.year 拼 range
// 4. mock fetchYearlyHeatmap 返 days（不是 cells）+ 接受 params.year

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

const REPORTS_VUE = readFileSync(
  join(__dirname, '../../../src/views/Reports.vue'),
  'utf-8',
)
const COMPLETION_HEATMAP_VUE = readFileSync(
  join(__dirname, '../../../src/components/reports/CompletionHeatmap.vue'),
  'utf-8',
)
const MOCK_REPORTS = readFileSync(
  join(__dirname, '../../../src/mocks/modules/reports.js'),
  'utf-8',
)
const STORES_REPORTS = readFileSync(
  join(__dirname, '../../../src/stores/reports.js'),
  'utf-8',
)

describe('B0322 — Reports.vue 年报路径接 yearly-heatmap（源码守护）', () => {
  it('【loadReport 年报分支】源码含 `reportType.value === \'yearly\'` + fetchYearlyHeatmap 调用', () => {
    expect(REPORTS_VUE).toMatch(/reportType\.value\s*===\s*['"]yearly['"]/)
    expect(REPORTS_VUE).toMatch(/reportsStore\.fetchYearlyHeatmap\(/)
  })

  it('【年报时设 yearlyHeatmap】响应 days 字段赋给 yearlyHeatmap.value', () => {
    expect(REPORTS_VUE).toMatch(/yearlyHeatmap\.value\s*=\s*hmRes\.data\.days/)
  })

  it('【非年报时清空 yearlyHeatmap】周/月报不显示 365 天数据', () => {
    expect(REPORTS_VUE).toMatch(/yearlyHeatmap\.value\s*=\s*null/)
  })

  it('【CompletionHeatmap year prop 模板】年报时传 :year', () => {
    expect(REPORTS_VUE).toMatch(/:year\s*=\s*['"]?reportType\s*===\s*['"]yearly['"]\s*\?\s*heatmapYear\s*:\s*null/)
  })

  it('【CompletionHeatmap data prop 模板】年报时传 yearlyHeatmap，周/月报传 report.heatmap', () => {
    expect(REPORTS_VUE).toMatch(/:data\s*=\s*['"]?reportType\s*===\s*['"]yearly['"]\s*\?\s*yearlyHeatmap\s*:\s*report\.heatmap/)
  })
})

describe('B0322 — CompletionHeatmap.vue year prop（源码守护）', () => {
  it('【year prop 类型】defineProps 含 year: { type: Number }', () => {
    expect(COMPLETION_HEATMAP_VUE).toMatch(/year:\s*\{\s*type:\s*Number,\s*default:\s*null\s*\}/)
  })

  it('【calendar range 用 props.year】年报时 range = `${props.year}`', () => {
    // 锁定 range 计算逻辑：props.year 优先
    expect(COMPLETION_HEATMAP_VUE).toMatch(/props\.year\s*\?\s*`\$\{props\.year\}`/)
  })

  it('【year=null 兜底】未传 year 时回退到首日所在月（兼容周/月报）', () => {
    // 兜底：data[0]?.date || '2026-01'
    expect(COMPLETION_HEATMAP_VUE).toMatch(/props\.data\[0\]\?\.date\s*\|\|\s*['"]2026-01['"]/)
  })
})

describe('B0322 — mock fetchYearlyHeatmap 契约对齐真后端', () => {
  it('【mock 返 days 字段而非 cells】对齐后端 `data.days` 契约', () => {
    expect(MOCK_REPORTS).toMatch(/data:\s*\{\s*year,\s*days\s*\}/)
  })

  it('【mock 接受 params.year】可指定年份生成 days', () => {
    expect(MOCK_REPORTS).toMatch(/params\?\.year\s*\|\|\s*new Date\(\)\.getFullYear\(\)/)
  })

  it('【mock 不应返 cells】（B0322 重命名前的旧字段已废弃）', () => {
    // 守护：cells 字段不能在 mock 响应里残留
    expect(MOCK_REPORTS).not.toMatch(/data:\s*\{\s*cells\s*\}/)
  })
})

describe('B0322 — store fetchYearlyHeatmap action（源码守护）', () => {
  it('【store 有 fetchYearlyHeatmap action】', () => {
    expect(STORES_REPORTS).toMatch(/async\s+fetchYearlyHeatmap\s*\(\s*year\s*\)/)
  })

  it('【store 调 /reports/yearly-heatmap 端点】', () => {
    expect(STORES_REPORTS).toMatch(/api\.get\(['"]\/reports\/yearly-heatmap['"]/)
  })

  it('【store year 参数透传】params = year ? { year } : {}', () => {
    // 源码是 `const params = year ? { year } : {}`，grep 允许空格变体
    expect(STORES_REPORTS).toMatch(/params\s*=\s*year\s*\?\s*\{\s*year\s*\}\s*:\s*\{\s*\}/)
  })
})
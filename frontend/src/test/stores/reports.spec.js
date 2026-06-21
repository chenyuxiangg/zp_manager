// B0322 — useReportsStore.fetchYearlyHeatmap 测试
//
// 修复要点（必须守护）：
// 1. store 加 fetchYearlyHeatmap action（年报时独立调端点）
// 2. 不传 year 时不附带 year query 参数
// 3. 传 year 时附带 year=N query 参数

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setupTestPinia } from '@/test/helpers/store-mock'

const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}
vi.mock('@/api', () => ({
  default: mockApi,
}))

describe('useReportsStore — fetchYearlyHeatmap (B0322)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupTestPinia()
  })

  it('【无 year 参数】调 GET /reports/yearly-heatmap 不附带 year', async () => {
    const { useReportsStore } = await import('@/stores/reports')
    const store = useReportsStore()
    mockApi.get.mockResolvedValue({ success: true, data: { year: 2026, days: [] } })

    await store.fetchYearlyHeatmap()

    expect(mockApi.get).toHaveBeenCalledWith('/reports/yearly-heatmap', { params: {} })
  })

  it('【year=2024】调 GET /reports/yearly-heatmap?year=2024', async () => {
    const { useReportsStore } = await import('@/stores/reports')
    const store = useReportsStore()
    mockApi.get.mockResolvedValue({ success: true, data: { year: 2024, days: [] } })

    await store.fetchYearlyHeatmap(2024)

    expect(mockApi.get).toHaveBeenCalledWith('/reports/yearly-heatmap', { params: { year: 2024 } })
  })

  it('【返回响应透传】不做字段变形，原样返 api.get 的结果', async () => {
    const { useReportsStore } = await import('@/stores/reports')
    const store = useReportsStore()
    const apiRes = { success: true, data: { year: 2025, days: [{ date: '2025-01-01', count: 3 }] } }
    mockApi.get.mockResolvedValue(apiRes)

    const res = await store.fetchYearlyHeatmap(2025)

    expect(res).toBe(apiRes)
    expect(res.data.days).toEqual([{ date: '2025-01-01', count: 3 }])
  })
})
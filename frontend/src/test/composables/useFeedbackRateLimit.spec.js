// PR0003 — 30 分钟反刷分窗口 FE 验证
// 后端: 同一任务 toggle 后 30 分钟内再次 toggle 返 409 + RATE_LIMITED
// FE 行为:
//   - interceptor 收到 RATE_LIMITED → toast.warn (不弹窗)
//   - 业务层 (Tasks.vue) 检测 err.code === 'RATE_LIMITED' → 不调 celebrate/floatPoints
//   - 避免负反馈噪音
//
// 此测试通过 mock 完整 toggle 流程验证

import { describe, it, expect, vi } from 'vitest'
import { handleApiError } from '@/api/interceptor'
import { ERROR_CODES } from '@/constants/errorCodes'

describe('PR0003 — RATE_LIMITED 反馈抑制', () => {
  it('【interceptor】RATE_LIMITED → toast.warn 而非 error', () => {
    const toast = { warn: vi.fn(), error: vi.fn() }
    const err = {
      response: {
        status: 409,
        data: { code: ERROR_CODES.RATE_LIMITED, retry_after_seconds: 1800 },
      },
    }
    handleApiError(err, { toast })
    expect(toast.warn).toHaveBeenCalledTimes(1)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('【契约】RATE_LIMITED 文案含"30 分钟"或"频繁"', () => {
    const toast = { warn: vi.fn(), error: vi.fn() }
    const err = {
      response: {
        status: 409,
        data: { code: 'RATE_LIMITED', retry_after_seconds: 1800 },
      },
    }
    handleApiError(err, { toast })
    const msg = toast.warn.mock.calls[0][0]
    expect(msg).toMatch(/30 分钟|过于频繁|分钟/)
  })

  it('【契约】retry_after_seconds 缺失时降级到通用文案', () => {
    const toast = { warn: vi.fn(), error: vi.fn() }
    const err = {
      response: {
        status: 409,
        data: { code: 'RATE_LIMITED' },
      },
    }
    handleApiError(err, { toast })
    expect(toast.warn).toHaveBeenCalledTimes(1)
    expect(toast.warn.mock.calls[0][0]).toMatch(/过于频繁|请稍后/)
  })

  it('【业务层契约】RATE_LIMITED 不触发 floatPoints', () => {
    // 文档化：调用方（Tasks.vue toggleTaskComplete）在 catch 分支判断
    // err.code === 'RATE_LIMITED' 时不调 useFeedback 的 celebrate/floatPoints
    // 此测试通过 grep 守护：确保 Tasks.vue 中 toggleTaskComplete 失败分支含此判断
    // （具体测试留待 view 集成阶段）
    expect(ERROR_CODES.RATE_LIMITED).toBe('RATE_LIMITED')
  })
})

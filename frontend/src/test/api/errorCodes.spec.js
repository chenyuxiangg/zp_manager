// PR0017 — 错误码常量 + interceptor 分支测试（适配项目现有 errorCodes.js 形状）

import { describe, it, expect, vi, beforeEach } from 'vitest'

// 1) 错误码常量模块存在性 + 内容
describe('PR0017 — constants/errorCodes.js', () => {
  it('【导出】ERROR_CODES 至少含 16 个错误码', async () => {
    const mod = await import('@/constants/errorCodes')
    expect(Object.keys(mod.ERROR_CODES).length).toBeGreaterThanOrEqual(16)
  })

  it('【必备】覆盖认证/资源/业务规则/基础设施 4 类', async () => {
    const { ERROR_CODES } = await import('@/constants/errorCodes')
    // 认证类
    expect(ERROR_CODES.INVALID_CREDENTIALS).toBe('INVALID_CREDENTIALS')
    expect(ERROR_CODES.TOKEN_EXPIRED).toBe('TOKEN_EXPIRED')
    expect(ERROR_CODES.PERMISSION_DENIED).toBe('PERMISSION_DENIED')
    // 资源类
    expect(ERROR_CODES.RESOURCE_NOT_FOUND).toBe('RESOURCE_NOT_FOUND')
    expect(ERROR_CODES.TASK_ALREADY_COMPLETED).toBe('TASK_ALREADY_COMPLETED')
    expect(ERROR_CODES.POMODORO_ALREADY_RUNNING).toBe('POMODORO_ALREADY_RUNNING')
    // 业务规则
    expect(ERROR_CODES.RATE_LIMITED).toBe('RATE_LIMITED')
    expect(ERROR_CODES.TITLE_DUPLICATED).toBe('TITLE_DUPLICATED')
    // 基础设施
    expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
  })

  it('【字符串映射】ERROR_MESSAGES 包含每个 code 的中文文案', async () => {
    const { ERROR_CODES, ERROR_MESSAGES } = await import('@/constants/errorCodes')
    for (const code of Object.values(ERROR_CODES)) {
      expect(typeof ERROR_MESSAGES[code]).toBe('string')
      expect(ERROR_MESSAGES[code].length).toBeGreaterThan(0)
    }
  })
})

// 2) interceptor 分支测试 — 抽取为 handleApiError 纯函数便于单测
describe('PR0017 — handleApiError code-aware 分支', () => {
  let toast
  let handleApiError
  beforeEach(async () => {
    vi.resetModules()
    toast = { error: vi.fn(), warn: vi.fn() }
    const mod = await import('@/api/interceptor')
    handleApiError = mod.handleApiError
  })

  // B0311：PR0017 后端契约是嵌套结构 `{success:false, error:{code, message}, ...kwargs}`
  // 测试断言用嵌套形式，与真后端契约一致

  it('【RATE_LIMITED】409 → warn + 静态文案', () => {
    const err = {
      response: {
        status: 409,
        data: {
          success: false,
          error: { code: 'RATE_LIMITED', message: '30 分钟内不可重复操作' },
          retry_after_seconds: 1800,
        },
      },
    }
    handleApiError(err, { toast })
    expect(toast.warn).toHaveBeenCalledTimes(1)
    expect(toast.warn.mock.calls[0][0]).toMatch(/30 分钟|重复操作/)
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('【TASK_ALREADY_COMPLETED】409 → error + 友好文案', () => {
    const err = {
      response: {
        status: 409,
        data: { success: false, error: { code: 'TASK_ALREADY_COMPLETED', message: '已完成任务不可删除' } },
      },
    }
    handleApiError(err, { toast })
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error.mock.calls[0][0]).toMatch(/已完成|撤销/)
  })

  it('【POMODORO_ALREADY_RUNNING】409 → error + 提示', () => {
    const err = {
      response: {
        status: 409,
        data: { success: false, error: { code: 'POMODORO_ALREADY_RUNNING', message: '该任务已有专注进行中' } },
      },
    }
    handleApiError(err, { toast })
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error.mock.calls[0][0]).toMatch(/进行中|专注/)
  })

  it('【fallback】无 code 时回退到 err.message（嵌套 error.message）', () => {
    const err = {
      response: {
        status: 400,
        data: { success: false, error: { message: '字段不合法' } },
      },
    }
    handleApiError(err, { toast })
    expect(toast.error).toHaveBeenCalledWith('字段不合法')
  })

  it('【B0311 PERMISSION_DENIED】403 + code → error + 友好文案（非静默）', () => {
    // B0311 修复：PERMISSION_DENIED 不再静默，走 ERROR_MESSAGES 显示「无权限访问」
    const err = {
      response: {
        status: 403,
        data: { success: false, error: { code: 'PERMISSION_DENIED', message: '无权限访问' } },
      },
    }
    handleApiError(err, { toast })
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error.mock.calls[0][0]).toMatch(/无权限/)
  })

  it('【B0311 NOT_OWNER】403 + code → error + 友好文案', () => {
    const err = {
      response: {
        status: 403,
        data: { success: false, error: { code: 'NOT_OWNER', message: '只能操作自己的资源' } },
      },
    }
    handleApiError(err, { toast })
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error.mock.calls[0][0]).toMatch(/只能操作自己的资源/)
  })

  it('【B0311 NOT_ADMIN】403 + code → error + 友好文案', () => {
    const err = {
      response: {
        status: 403,
        data: { success: false, error: { code: 'NOT_ADMIN', message: '需要管理员权限' } },
      },
    }
    handleApiError(err, { toast })
    expect(toast.error).toHaveBeenCalledTimes(1)
    expect(toast.error.mock.calls[0][0]).toMatch(/需要管理员权限/)
  })

  it('【B0311 nested fallback】嵌套 error.message 优先于顶层 message', () => {
    // 后端契约是 error.message，但测试时如果 mock 或遗留接口返顶层 message，应 fallback
    const err = {
      response: {
        status: 400,
        data: { message: '顶层 message（已废弃）' },
      },
    }
    handleApiError(err, { toast })
    expect(toast.error).toHaveBeenCalledWith('顶层 message（已废弃）')
  })

  it('【skipErrorToast】PERMISSION_DENIED + skipErrorToast → 静默', () => {
    // 路由守卫场景：希望 PERMISSION_DENIED 静默，传 skipErrorToast: true
    const err = {
      response: {
        status: 403,
        data: { success: false, error: { code: 'PERMISSION_DENIED' } },
      },
      config: { skipErrorToast: true },
    }
    handleApiError(err, { toast })
    expect(toast.error).not.toHaveBeenCalled()
    expect(toast.warn).not.toHaveBeenCalled()
  })
})

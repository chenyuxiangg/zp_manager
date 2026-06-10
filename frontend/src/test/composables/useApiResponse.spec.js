// useApiResponse 测试
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useApiResponse } from '@/composables/useApiResponse'

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn()
}
vi.mock('@/composables/useToast', () => ({
  useToast: () => mockToast
}))

describe('useApiResponse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleSuccess', () => {
    it('calls toast.success with default message "操作成功"', () => {
      const { handleSuccess } = useApiResponse()
      handleSuccess()
      expect(mockToast.success).toHaveBeenCalledWith('操作成功')
    })

    it('calls toast.success with custom message', () => {
      const { handleSuccess } = useApiResponse()
      handleSuccess('保存成功')
      expect(mockToast.success).toHaveBeenCalledWith('保存成功')
    })
  })

  describe('handleError', () => {
    it('extracts message from error.response.data.message', () => {
      const { handleError } = useApiResponse()
      const err = { response: { data: { message: '服务器错误' } } }
      handleError(err)
      expect(mockToast.error).toHaveBeenCalledWith('服务器错误')
    })

    it('falls back to error.message when no response data', () => {
      const { handleError } = useApiResponse()
      const err = new Error('Network failed')
      handleError(err)
      expect(mockToast.error).toHaveBeenCalledWith('Network failed')
    })

    it('falls back to "操作失败" when no message available', () => {
      const { handleError } = useApiResponse()
      handleError({})
      expect(mockToast.error).toHaveBeenCalledWith('操作失败')
    })
  })

  describe('handleLoading', () => {
    it('returns toast.loading id', () => {
      mockToast.loading.mockReturnValue('toast-123')
      const { handleLoading } = useApiResponse()
      const id = handleLoading('处理中...')
      expect(mockToast.loading).toHaveBeenCalledWith('处理中...')
      expect(id).toBe('toast-123')
    })
  })
})

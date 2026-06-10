import { useToast } from './useToast'

export function useApiResponse() {
  const toast = useToast()

  const handleSuccess = (message = '操作成功') => {
    toast.success(message)
  }

  const handleError = (error) => {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      '操作失败'
    toast.error(message)
  }

  const handleLoading = (message = '处理中...') => {
    const id = toast.loading(message)
    return id
  }

  return {
    handleSuccess,
    handleError,
    handleLoading
  }
}
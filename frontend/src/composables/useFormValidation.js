import { ref } from 'vue'

// 预定义校验规则工厂（独立导出）
export const required = (message = '此字段必填') => (value) =>
  !value ? message : null

export const minLength = (len, message) => (value) =>
  value && value.length < len
    ? (message || `至少${len}个字符`)
    : null

export const maxLength = (len, message) => (value) =>
  value && value.length > len
    ? (message || `最多${len}个字符`)
    : null

export const email = (message = '请输入有效邮箱') => (value) =>
  value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? message : null

export const password = (message = '密码至少6个字符') => (value) =>
  value && value.length < 6 ? message : null

export const pattern = (regex, message) => (value) =>
  value && !regex.test(value) ? message : null

// 预定义规则集合（向后兼容）
export const rules = { required, minLength, maxLength, email, password, pattern }

// 主 composable
export function useFormValidation(initialValues, validationRules) {
  const errors = ref({})
  const touched = ref({})

  const validate = (field, value) => {
    const fieldRules = validationRules[field]
    if (!fieldRules) return null

    for (const rule of fieldRules) {
      const msg = rule(value)
      if (msg) return msg
    }
    return null
  }

  const validateAll = (values) => {
    let valid = true
    for (const field in validationRules) {
      const msg = validate(field, values[field])
      if (msg) {
        errors.value[field] = msg
        valid = false
      } else {
        delete errors.value[field]
      }
    }
    return valid
  }

  const clearErrors = () => {
    errors.value = {}
  }

  const setTouched = (field) => {
    touched.value[field] = true
  }

  const getError = (field) => {
    return touched.value[field] ? errors.value[field] : null
  }

  return {
    errors,
    touched,
    validate,
    validateAll,
    clearErrors,
    setTouched,
    getError
  }
}
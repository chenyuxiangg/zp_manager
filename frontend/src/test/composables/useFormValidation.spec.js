// useFormValidation 测试
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { useFormValidation, required, email, minLength, maxLength, pattern } from '@/composables/useFormValidation'

describe('useFormValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rule factories', () => {
    describe('required', () => {
      it('returns error for empty string', () => {
        const rule = required('必填')
        expect(rule('')).toBe('必填')
      })

      it('returns null for non-empty value', () => {
        const rule = required('必填')
        expect(rule('hello')).toBeNull()
      })
    })

    describe('email', () => {
      it('returns error for invalid email', () => {
        const rule = email('邮箱格式不正确')
        expect(rule('not-an-email')).toBe('邮箱格式不正确')
      })

      it('returns null for valid email', () => {
        const rule = email('邮箱格式不正确')
        expect(rule('a@b.com')).toBeNull()
      })
    })

    describe('minLength', () => {
      it('returns error when below min length', () => {
        const rule = minLength(3, '至少 3 字符')
        expect(rule('ab')).toBe('至少 3 字符')
      })

      it('returns null when at/above min length', () => {
        const rule = minLength(3, '至少 3 字符')
        expect(rule('abc')).toBeNull()
        expect(rule('abcd')).toBeNull()
      })
    })

    describe('maxLength', () => {
      it('returns error when above max length', () => {
        const rule = maxLength(5, '最多 5 字符')
        expect(rule('abcdef')).toBe('最多 5 字符')
      })

      it('returns null when at/below max length', () => {
        const rule = maxLength(5, '最多 5 字符')
        expect(rule('abc')).toBeNull()
      })
    })

    describe('pattern', () => {
      it('returns error when pattern does not match', () => {
        const rule = pattern(/^[A-Z]+$/, '必须大写')
        expect(rule('abc')).toBe('必须大写')
      })

      it('returns null when pattern matches', () => {
        const rule = pattern(/^[A-Z]+$/, '必须大写')
        expect(rule('ABC')).toBeNull()
      })
    })
  })

  describe('composable usage', () => {
    it('validateAll: returns true when all valid', () => {
      const form = ref({ email: 'a@b.com', password: 'pw' })
      const { validateAll } = useFormValidation(
        { email: '', password: '' },
        {
          email: [required('请输入邮箱'), email('邮箱格式不正确')],
          password: [required('请输入密码')]
        }
      )

      expect(validateAll(form.value)).toBe(true)
    })

    it('validateAll: returns false and sets errors when invalid', () => {
      const form = ref({ email: '', password: '' })
      const { validateAll, errors } = useFormValidation(
        { email: '', password: '' },
        {
          email: [required('请输入邮箱')],
          password: [required('请输入密码')]
        }
      )

      expect(validateAll(form.value)).toBe(false)
      expect(errors.value.email).toBe('请输入邮箱')
      expect(errors.value.password).toBe('请输入密码')
    })

    it('clearErrors: resets all errors', () => {
      const form = ref({ email: '' })
      const { validateAll, clearErrors, errors } = useFormValidation(
        { email: '' },
        { email: [required('required')] }
      )

      validateAll(form.value)
      expect(errors.value.email).toBe('required')

      clearErrors()
      // clearErrors 把 errors 整个重置为空对象，字段变为 undefined
      expect(errors.value.email).toBeUndefined()
    })

    it('getError: only returns error if touched', () => {
      const form = ref({ email: '' })
      const { validateAll, getError, setTouched } = useFormValidation(
        { email: '' },
        { email: [required('required')] }
      )

      validateAll(form.value)
      // 未 setTouched 前不应返回错误
      expect(getError('email')).toBeNull()
      setTouched('email')
      // setTouched 后应返回错误
      expect(getError('email')).toBe('required')
    })
  })
})

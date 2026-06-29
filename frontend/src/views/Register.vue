<template>
  <!-- AuthLayout 提供 shell + 卡片背景；此处只放视图内容 -->
  <h1>注册</h1>
  <form @submit.prevent="handleRegister">
    <div class="form-group">
      <!-- B0302: 迁 BaseInput -->
      <BaseInput
        v-model="formData.username"
        type="text"
        label="用户名"
        placeholder="请输入用户名"
        :error="!!getError('username')"
        :error-message="getError('username') || ''"
        @blur="setTouched('username')"
      />
    </div>
    <div class="form-group">
      <BaseInput
        v-model="formData.email"
        type="email"
        label="邮箱"
        placeholder="请输入邮箱"
        :error="!!getError('email')"
        :error-message="getError('email') || ''"
        @blur="setTouched('email')"
      />
    </div>
    <div class="form-group">
      <label>密码</label>
      <PasswordInput
        v-model="formData.password"
        placeholder="请输入密码（至少6位）"
        :error="getError('password')"
        @blur="setTouched('password')"
      />
    </div>
    <button type="submit" :disabled="loading">{{ loading ? '注册中...' : '注册' }}</button>
    <p class="switch-link">
      已有账号？<router-link to="/login">立即登录</router-link>
    </p>
  </form>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useFormValidation, required, minLength, email } from '@/composables/useFormValidation'
import PasswordInput from '@/components/common/PasswordInput.vue'
// B0302: 统一表单基元
import BaseInput from '@/components/base/BaseInput.vue'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

const formData = ref({ username: '', email: '', password: '' })
const loading = ref(false)

const { validateAll, clearErrors, setTouched, getError } = useFormValidation(
  { username: '', email: '', password: '' },
  {
    username: [required('请输入用户名'), minLength(3, '用户名至少3个字符')],
    email: [required('请输入邮箱'), email('请输入有效邮箱')],
    password: [required('请输入密码'), minLength(6, '密码至少6个字符')]
  }
)

async function handleRegister() {
  clearErrors()
  if (!validateAll(formData.value)) {
    return
  }

  loading.value = true
  try {
    const res = await authStore.register(formData.value.username, formData.value.email, formData.value.password)
    loading.value = false
    if (res.success) {
      toast.success('注册成功')
      router.push('/dashboard')
    } else {
      toast.error(res.error?.message || '注册失败')
    }
  } catch (e) {
    loading.value = false
    toast.error(e?.response?.data?.error?.message || '注册失败')
  }
}
</script>

<style scoped>
/* AuthLayout 负责外层 shell + 卡片背景，本 view 只管内容样式 */

h1 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: var(--space-lg);
  text-align: center;
  color: var(--text-primary);
}

.form-group {
  display: flex;
  flex-direction: column;
  margin-bottom: var(--space-md);
}

.form-group label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: var(--space-xs);
  color: var(--color-secondary);
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-alpha);
}

.form-group input.error {
  border-color: var(--color-error);
}

.field-error {
  color: var(--color-error);
  font-size: 12px;
  margin-top: 4px;
}

button {
  width: 100%;
  padding: 12px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

button:hover {
  opacity: 0.9;
}

button:active {
  transform: scale(0.98);
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.switch-link {
  margin-top: var(--space-md);
  text-align: center;
  font-size: 14px;
  color: var(--color-secondary);
}

.switch-link a {
  color: var(--color-accent);
  text-decoration: none;
}
</style>
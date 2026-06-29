<template>
  <!-- AuthLayout 提供 shell + 卡片背景；此处只放视图内容 -->
  <h1>忘记密码</h1>
  <p class="desc">输入您注册时使用的邮箱地址，我们将发送重置链接</p>

  <form @submit.prevent="requestReset">
    <div class="form-group">
      <!-- B0302: 迁 BaseInput -->
      <BaseInput
        v-model="email"
        type="email"
        label="邮箱"
        placeholder="请输入邮箱"
        required
      />
    </div>
    <button type="submit" :disabled="loading">
      {{ loading ? '发送中...' : '发送重置链接' }}
    </button>
  </form>

  <p v-if="success" class="success-msg">发送成功！请检查您的邮箱。</p>
  <p v-if="error" class="error-msg">{{ error }}</p>

  <p class="switch-link">
    记起密码了？<router-link to="/login">返回登录</router-link>
  </p>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
// B0302: 统一表单基元
import BaseInput from '@/components/base/BaseInput.vue'

const router = useRouter()
const authStore = useAuthStore()
const email = ref('')
const loading = ref(false)
const success = ref(false)
const error = ref('')

async function requestReset() {
  loading.value = true
  error.value = ''
  success.value = false

  try {
    const res = await authStore.forgotPassword(email.value)
    if (res.success) {
      success.value = true
    } else {
      error.value = res.error?.message || '发送失败'
    }
  } catch (e) {
    error.value = e?.response?.data?.error?.message || '发送失败，请稍后重试'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* AuthLayout 负责外层 shell + 卡片背景，本 view 只管内容样式 */

h1 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 8px;
  text-align: center;
  color: var(--text-primary);
}

.desc {
  font-size: 14px;
  color: var(--color-secondary);
  text-align: center;
  margin-bottom: 24px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--color-secondary);
}

.form-group input {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus {
  border-color: var(--color-accent);
}

button[type="submit"] {
  width: 100%;
  padding: 12px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
}

button[type="submit"]:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.success-msg {
  font-size: 14px;
  color: var(--color-success);
  text-align: center;
  margin-top: 16px;
}

.error-msg {
  font-size: 14px;
  color: var(--color-error);
  text-align: center;
  margin-top: 16px;
}

.switch-link {
  margin-top: 24px;
  text-align: center;
  font-size: 14px;
  color: var(--color-secondary);
}

.switch-link a {
  color: var(--color-accent);
  text-decoration: none;
}
</style>
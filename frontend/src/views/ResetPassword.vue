<template>
  <!-- AuthLayout 提供 shell + 卡片背景（gradient 变体：紫蓝渐变）；此处只放视图内容 -->
  <h1>重置密码</h1>
  <p v-if="!tokenValid && !error" class="desc">正在验证链接...</p>
  <p v-if="tokenValid && !success" class="desc">请输入您的新密码</p>
  <p v-if="success" class="success-msg">密码重置成功！即将跳转到登录页面...</p>
  <p v-if="error" class="error-msg">{{ error }}</p>

  <form v-if="tokenValid && !success" @submit.prevent="resetPassword">
    <div class="form-group">
      <!-- B0302: 迁 BaseInput -->
      <BaseInput
        v-model="password"
        type="password"
        label="新密码"
        placeholder="至少6位字符"
        required
        minlength="6"
      />
    </div>
    <div class="form-group">
      <BaseInput
        v-model="confirmPassword"
        type="password"
        label="确认密码"
        placeholder="再次输入密码"
        required
      />
    </div>
    <button type="submit" :disabled="loading">
      {{ loading ? '提交中...' : '重置密码' }}
    </button>
  </form>

  <button v-if="success" class="btn-login" @click="goToLogin">
    前往登录
  </button>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
// B0302: 统一表单基元
import BaseInput from '@/components/base/BaseInput.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const token = ref('')
const tokenValid = ref(false)
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const success = ref(false)
const error = ref('')

onMounted(() => {
  const urlToken = route.query.token
  if (urlToken) {
    token.value = urlToken
    tokenValid.value = true
  } else {
    error.value = '无效的重置链接，请重新获取'
  }
})

async function resetPassword() {
  if (password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }

  if (password.value.length < 6) {
    error.value = '密码长度至少为6位'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const res = await authStore.resetPassword(token.value, password.value)
    if (res.success) {
      success.value = true
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } else {
      error.value = res.error?.message || '重置失败'
    }
  } catch (e) {
    error.value = e?.response?.data?.error?.message || '重置失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

function goToLogin() {
  router.push('/login')
}
</script>

<style scoped>
/* AuthLayout 提供外层 shell + 卡片背景（紫蓝渐变 variant=gradient），本 view 只管内容样式 */

h1 {
  font-size: 24px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.desc {
  font-size: 14px;
  color: var(--color-secondary);
  text-align: center;
  margin-bottom: 24px;
}

.success-msg {
  font-size: 14px;
  color: var(--color-success);
  text-align: center;
  margin-bottom: 24px;
}

.error-msg {
  font-size: 14px;
  color: var(--color-error);
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

.btn-login {
  width: 100%;
  padding: 12px;
  background: transparent;
  color: var(--color-accent);
  border: 1px solid var(--color-accent);
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  margin-top: 16px;
}
</style>
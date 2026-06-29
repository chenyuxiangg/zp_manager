<template>
  <!-- AuthLayout 提供 shell + 卡片背景；此处只放视图内容 -->
  <!-- PR0013: 会话过期 banner -->
  <div v-if="expired" class="expired-banner" role="alert">⚠️ 会话已过期，请重新登录</div>
  <h1>登录</h1>
  <form @submit.prevent="handleLogin">
    <div class="form-group">
      <!-- B0302: 迁 BaseInput -->
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
        placeholder="请输入密码"
        :error="getError('password')"
        @blur="setTouched('password')"
      />
    </div>
    <button type="submit" :disabled="loading">{{ loading ? '登录中...' : '登录' }}</button>
    <p class="switch-link">
      还没有账号？<router-link to="/register">立即注册</router-link>
    </p>
    <p class="forgot-link">
      <router-link to="/forgot-password">忘记密码？</router-link>
    </p>
  </form>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { useFormValidation, required, email } from '@/composables/useFormValidation'
import PasswordInput from '@/components/common/PasswordInput.vue'
// B0302: 统一表单基元
import BaseInput from '@/components/base/BaseInput.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()

// PR0013: 监听 query.reason 显示 banner
const expired = computed(() => route.query.reason === 'expired')

const formData = ref({ email: '', password: '' })
const loading = ref(false)

const { validateAll, clearErrors, setTouched, getError } = useFormValidation(
  { email: '', password: '' },
  {
    email: [required('请输入邮箱'), email('请输入有效邮箱')],
    password: [required('请输入密码')]
  }
)

async function handleLogin() {
  clearErrors()
  if (!validateAll(formData.value)) {
    return
  }

  loading.value = true
  try {
    const res = await authStore.login(formData.value.email, formData.value.password)
    loading.value = false

    if (res.success) {
      toast.success('登录成功')
      router.push('/dashboard')
    } else {
      // 极少数情况：未走 skipErrorToast 时收到 success=false 的 res
      const code = res.error?.code
      if (code === 'INVALID_CREDENTIALS' || res.status === 401) {
        toast.error('用户名或密码不正确')
      } else {
        toast.error(res.error?.message || '登录失败')
      }
    }
  } catch (e) {
    // 登录失败走 skipErrorToast 路径，错误对象会通过 reject 抛到此处
    loading.value = false
    const code = e?.response?.data?.error?.code
    const status = e?.response?.status
    if (code === 'INVALID_CREDENTIALS' || status === 401) {
      toast.error('用户名或密码不正确')
    } else if (status >= 500) {
      // 5xx 时全局拦截器已弹 toast，登录页不重复
      // 不调用 toast
    } else {
      toast.error(e?.response?.data?.message || '登录失败')
    }
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
  box-sizing: border-box;
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

.forgot-link {
  margin-top: var(--space-sm);
  text-align: center;
  font-size: 13px;
}

.forgot-link a {
  color: var(--color-secondary);
  text-decoration: none;
}

.forgot-link a:hover {
  color: var(--color-accent);
}

/* B0340 — .expired-banner 视觉规范（PR0013 实施时漏配，方案稿 rr2_pr_b0340_analy.md §4）
   决策点：D1=A 警示橙底 / D2=A emoji ⚠️ / D3=A 不可关闭 / D4=A 保留 role="alert" */
.expired-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  margin-bottom: var(--space-md);
  background: rgba(255, 149, 0, 0.12);
  border-left: 3px solid var(--color-warning, #ff9500);
  border-radius: 6px;
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.5;
  animation: banner-in 0.3s ease;
}

@keyframes banner-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
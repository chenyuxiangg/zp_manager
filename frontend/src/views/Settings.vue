<template>
  <div class="layout">
    <main class="main-content">
      <div class="settings-page">
        <h1>设置</h1>
        <div class="settings-section glass">
          <h2>个人信息</h2>
          <div class="info-row">
            <span class="label">用户名</span>
            <span>{{ authStore.user?.username }}</span>
          </div>
          <div class="info-row">
            <span class="label">邮箱</span>
            <span>{{ authStore.user?.email }}</span>
          </div>
        </div>
        <div class="settings-section glass">
          <h2>提醒设置</h2>
          <div class="form-group">
            <label>学习提醒</label>
            <select v-model="notifyConfig.learn_reminder.timing">
              <option value="1 day">提前1天</option>
              <option value="2 days">提前2天</option>
              <option value="1 hour">提前1小时</option>
            </select>
          </div>
          <div class="form-group">
            <label>验收提醒</label>
            <select v-model="notifyConfig.verify_reminder.timing">
              <option value="on due">到期当天</option>
              <option value="1 day">提前1天</option>
            </select>
          </div>
          <button @click="saveNotifyConfig" :disabled="saving">
            {{ saving ? '保存中...' : '保存设置' }}
          </button>
        </div>

        <!-- B0253: 番茄钟设置 (PR0022 §3 共享 Settings 入口) -->
        <div class="settings-section glass">
          <h2>番茄钟</h2>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="notifyConfig.pomodoro.break_enabled" />
              专注后开启休息
            </label>
          </div>
          <div class="form-group">
            <!-- B0302: 迁 BaseInput (number 类型) -->
            <BaseInput
              type="number"
              label="休息时长（分钟）"
              :model-value="notifyConfig.pomodoro.break_minutes"
              @update:model-value="(v) => notifyConfig.pomodoro.break_minutes = Number(v)"
              :min="1"
              :max="30"
            />
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="notifyConfig.pomodoro.background_keep_alive" />
              后台运行时继续计时
            </label>
          </div>
        </div>

        <!-- B0253: Streak 里程碑 (PR0009) -->
        <div class="settings-section glass">
          <h2>Streak 里程碑</h2>
          <div class="form-group">
            <label>当前目标</label>
            <select v-model.number="notifyConfig.streak.next_milestone">
              <option :value="7">7 天</option>
              <option :value="30">30 天</option>
              <option :value="100">100 天</option>
            </select>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" v-model="notifyConfig.streak.flame_visible" />
              仪表盘显示火焰图标
            </label>
          </div>
        </div>

        <!-- B0253: 引导与新功能 (PR0012) -->
        <div class="settings-section glass">
          <h2>引导与新功能</h2>
          <button @click="restartOnboarding">重新观看 5 步引导</button>
        </div>

        <div class="settings-section glass">
          <h2>积分历史</h2>
          <div v-if="pointsHistory.length" class="points-history">
            <div v-for="log in pointsHistory" :key="log.id" class="points-log-item">
              <div class="log-info">
                <span :class="log.delta > 0 ? 'delta-positive' : 'delta-negative'">
                  {{ log.delta > 0 ? '+' : '' }}{{ log.delta }}
                </span>
                <span class="log-reason">{{ log.reason }}</span>
              </div>
              <div class="log-time">{{ log.created_at }}</div>
            </div>
          </div>
          <div v-else class="empty-state">暂无积分记录</div>
          <button v-if="hasMore" @click="loadMorePoints" class="btn-load-more">加载更多</button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
// B0303: 通过 store action 调用 notify-config / points-history
// B0253: 替换 alert 为 useToast
import { useToast } from '@/composables/useToast'
// B0302: 统一表单基元
import BaseInput from '@/components/base/BaseInput.vue'
const toast = useToast()

const router = useRouter()
const authStore = useAuthStore()
const saving = ref(false)
const notifyConfig = ref({
  learn_reminder: { enabled: true, timing: '1 day', channels: ['email'] },
  verify_reminder: { enabled: true, timing: 'on due', channels: ['email'] },
  email: '',
  // B0253: 4 段新增字段默认值（与 PR0022 §3 DEFAULTS 对齐）
  onboarded: false,
  pomodoro: {
    break_enabled: true,
    break_minutes: 5,
    background_keep_alive: true,
  },
  streak: {
    next_milestone: 7,
    flame_visible: true,
  },
})
const pointsHistory = ref([])
const currentPage = ref(1)
const hasMore = ref(false)

onMounted(async () => {
  if (authStore.user?.notify_config) {
    notifyConfig.value = { ...authStore.user.notify_config }
  }
  await loadPointsHistory()
})

async function loadPointsHistory() {
  const res = await authStore.fetchPointsHistory({ page: 1, limit: 20 })
  if (res.success) {
    pointsHistory.value = res.data.logs || []
    hasMore.value = pointsHistory.value.length >= 20
  }
}

async function loadMorePoints() {
  currentPage.value++
  const res = await authStore.fetchPointsHistory({ page: currentPage.value, limit: 20 })
  if (res.success) {
    pointsHistory.value.push(...(res.data.logs || []))
    hasMore.value = res.data.logs?.length >= 20
  }
}

async function saveNotifyConfig() {
  saving.value = true
  // B0304: 统一 payload 形状 { onboarded, learn_reminder, ... }
  const res = await authStore.updateNotifyConfig(notifyConfig.value)
  saving.value = false
  if (res.success) {
    // B0253: 替换 alert 为 useToast.success
    toast.success('设置已保存')
  } else {
    toast.error(res.error || '保存失败')
  }
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

// B0253: 重新观看引导 (PR0012 入口)
async function restartOnboarding() {
  try {
    // B0304: 统一端点 — setOnboarded(false) 走 PUT /users/notify-config {onboarded: false}
    await authStore.setOnboarded(false)
    // 跳 /dashboard，由 App.vue onMounted 检测 shouldShow 后启动 tour
    router.push('/dashboard')
  } catch (e) {
    toast.error('重启引导失败')
  }
}
</script>

<style scoped>
.layout { min-height: 100vh; background: var(--color-surface); }
.header { position: sticky; top: 0; border-bottom: 1px solid var(--color-border); }
.header-content { max-width: 1200px; margin: 0 auto; padding: 0 var(--space-lg); height: 56px; display: flex; align-items: center; gap: var(--space-lg); }
.logo { font-size: 20px; font-weight: 700; }
nav { display: flex; gap: var(--space-md); flex: 1; }
nav a { color: var(--color-secondary); text-decoration: none; font-size: 14px; }
nav a:hover, nav a.router-link-active { color: var(--color-primary); }
.user-info { display: flex; align-items: center; gap: var(--space-md); font-size: 14px; }
.points { color: var(--color-accent); font-weight: 600; }
.user-info button { padding: 6px 12px; border: 1px solid var(--color-border); background: transparent; border-radius: 6px; cursor: pointer; font-size: 13px; }
.main-content { max-width: 800px; margin: 0 auto; padding: var(--space-xl) var(--space-lg); }
.settings-page h1 { font-size: 24px; font-weight: 600; margin-bottom: var(--space-lg); }
.settings-section { padding: var(--space-lg); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.5); margin-bottom: var(--space-lg); }
.settings-section h2 { font-size: 16px; font-weight: 600; margin-bottom: var(--space-md); }
.info-row { display: flex; gap: var(--space-md); padding: var(--space-sm) 0; border-bottom: 1px solid var(--color-border); }
.info-row:last-of-type { border-bottom: none; }
.info-row .label { color: var(--color-secondary); width: 80px; }
.form-group { margin-bottom: var(--space-md); }
.form-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: var(--space-xs); }
.form-group select { width: 100%; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 8px; font-size: 14px; outline: none; }
.settings-section button { padding: 10px 20px; background: var(--color-accent); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
.settings-section button:disabled { opacity: 0.6; }
.points-history { display: flex; flex-direction: column; gap: var(--space-sm); margin-bottom: var(--space-md); }
.points-log-item { display: flex; justify-content: space-between; align-items: center; padding: var(--space-sm) var(--space-md); background: var(--color-surface); border-radius: 6px; }
.log-info { display: flex; align-items: center; gap: var(--space-md); }
.delta-positive { color: var(--color-success); font-weight: 600; }
.delta-negative { color: var(--color-error); font-weight: 600; }
.log-reason { font-size: 13px; color: var(--color-secondary); }
.log-time { font-size: 12px; color: var(--color-secondary); }
.btn-load-more { margin-top: var(--space-sm); background: transparent; border: 1px solid var(--color-border); color: var(--color-secondary); }
.empty-state { text-align: center; padding: var(--space-md); color: var(--color-secondary); font-size: 13px; }
</style>
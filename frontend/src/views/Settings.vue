<template>
  <div class="layout">
    <header class="header glass">
      <div class="header-content">
        <div class="logo">Zpersion</div>
        <nav>
          <router-link to="/dashboard">仪表盘</router-link>
          <router-link to="/plans">计划</router-link>
          <router-link to="/tasks">任务</router-link>
          <router-link to="/reports">报表</router-link>
          <router-link to="/settings">设置</router-link>
          <router-link v-if="authStore.user?.is_admin" to="/admin">管理</router-link>
        </nav>
        <div class="user-info">
          <span>{{ authStore.user?.username }}</span>
          <span class="points">{{ authStore.user?.points || 0 }} 积分</span>
          <button @click="handleLogout">退出</button>
        </div>
      </div>
    </header>
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
import api from '@/api'

const router = useRouter()
const authStore = useAuthStore()
const saving = ref(false)
const notifyConfig = ref({
  learn_reminder: { enabled: true, timing: '1 day', channels: ['email'] },
  verify_reminder: { enabled: true, timing: 'on due', channels: ['email'] },
  email: ''
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
  const res = await api.get('/users/points/history', { params: { page: 1, limit: 20 } })
  if (res.success) {
    pointsHistory.value = res.data.logs || []
    hasMore.value = pointsHistory.value.length >= 20
  }
}

async function loadMorePoints() {
  currentPage.value++
  const res = await api.get('/users/points/history', { params: { page: currentPage.value, limit: 20 } })
  if (res.success) {
    pointsHistory.value.push(...(res.data.logs || []))
    hasMore.value = res.data.logs?.length >= 20
  }
}

async function saveNotifyConfig() {
  saving.value = true
  const res = await api.put('/users/notify-config', { notify_config: notifyConfig.value })
  saving.value = false
  if (res.success) {
    alert('设置已保存')
  }
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
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
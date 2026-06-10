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
      <div class="dashboard">
        <div class="stats-grid">
          <div class="stat-card glass">
            <div class="stat-label">我的积分</div>
            <div class="stat-value">{{ authStore.user?.points || 0 }}</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-label">总任务</div>
            <div class="stat-value">{{ profile?.stats?.total_tasks || 0 }}</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-label">已完成</div>
            <div class="stat-value">{{ profile?.stats?.completed_tasks || 0 }}</div>
          </div>
          <div class="stat-card glass">
            <div class="stat-label">超期任务</div>
            <div class="stat-value overdue">{{ profile?.stats?.overdue_tasks || 0 }}</div>
          </div>
        </div>
        <div class="section">
          <h2>今日任务</h2>
          <div v-if="loading" class="skeleton-list">
            <div v-for="i in 3" :key="i" class="skeleton-task"></div>
          </div>
          <div v-else-if="todayTasks.length" class="task-list">
            <div v-for="task in todayTasks" :key="task.id" class="task-item glass">
              <div class="task-content">
                <div class="task-title">{{ task.title }}</div>
                <div v-if="task.description" class="task-desc" v-html="task.description"></div>
              </div>
              <button
                v-if="task.status !== 'completed'"
                @click="completeTask(task.id)"
                class="btn-complete"
              >
                完成
              </button>
              <span v-else class="completed-tag">✓ 已完成</span>
            </div>
          </div>
          <EmptyState
            v-else
            icon="📅"
            title="今日暂无任务"
            description="去看看有哪些计划可以开始执行"
            action-text="查看计划"
            @action="router.push('/plans')"
          />
        </div>
        <div class="section">
          <h2>超期任务</h2>
          <div v-if="loading" class="skeleton-list">
            <div v-for="i in 2" :key="i" class="skeleton-task"></div>
          </div>
          <div v-else-if="overdueTasks.length" class="task-list">
            <div v-for="task in overdueTasks" :key="task.id" class="task-item glass overdue-item">
              <div class="task-content">
                <div class="task-title">{{ task.title }}</div>
                <div v-if="task.description" class="task-desc" v-html="task.description"></div>
              </div>
            </div>
          </div>
          <EmptyState
            v-else
            icon="🎉"
            title="无超期任务"
            description="太棒了！所有任务都在按计划执行"
          />
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import EmptyState from '@/components/common/EmptyState.vue'
import api from '@/api'

const router = useRouter()
const authStore = useAuthStore()
const toast = useToast()
const profile = ref(null)
const todayTasks = ref([])
const overdueTasks = ref([])
const loading = ref(false)

onMounted(async () => {
  await authStore.fetchUser()
  await loadData()
})

async function loadData() {
  loading.value = true
  const [profileRes, todayRes, overdueRes] = await Promise.all([
    api.get('/users/profile'),
    api.get('/tasks/today'),
    api.get('/tasks/overdue')
  ])
  if (profileRes.success) profile.value = profileRes.data
  if (todayRes.success) todayTasks.value = todayRes.data.tasks || []
  if (overdueRes.success) overdueTasks.value = overdueRes.data.tasks || []
  loading.value = false
}

async function completeTask(taskId) {
  try {
    const res = await api.put(`/tasks/${taskId}/complete`)
    if (res.success) {
      toast.success('任务完成！')
      await loadData()
      await authStore.fetchUser()
    } else {
      toast.error(res.error?.message || '操作失败')
    }
  } catch (e) {
    toast.error(e?.response?.data?.error?.message || '操作失败')
  }
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}
</script>

<style scoped>
.layout {
  min-height: 100vh;
  background: var(--color-surface);
}

.header {
  position: sticky;
  top: 0;
  border-bottom: 1px solid var(--color-border);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-lg);
  height: 56px;
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}

.logo {
  font-size: 20px;
  font-weight: 700;
}

nav {
  display: flex;
  gap: var(--space-md);
  flex: 1;
}

nav a {
  color: var(--color-secondary);
  text-decoration: none;
  font-size: 14px;
  transition: color 0.2s;
}

nav a:hover, nav a.router-link-active {
  color: var(--color-primary);
}

.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  font-size: 14px;
}

.points {
  color: var(--color-accent);
  font-weight: 600;
}

.user-info button {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.user-info button:hover {
  background: var(--color-surface);
}

.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-lg);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.stat-card {
  padding: var(--space-lg);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.stat-label {
  font-size: 13px;
  color: var(--color-secondary);
  margin-bottom: var(--space-xs);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
}

.stat-value.overdue {
  color: var(--color-error);
}

.section {
  margin-bottom: var(--space-xl);
}

.section h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: var(--space-md);
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.task-item {
  padding: var(--space-md);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  transition: all 0.2s;
}

.task-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-weight: 500;
  color: var(--color-primary);
}

.task-desc {
  font-size: 13px;
  color: var(--color-secondary);
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-complete {
  padding: 8px 16px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.2s;
  flex-shrink: 0;
}

.btn-complete:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-complete:active {
  transform: scale(0.98);
}

.completed-tag {
  color: var(--color-success);
  font-size: 13px;
  font-weight: 500;
  flex-shrink: 0;
}

.overdue-item {
  border-left: 3px solid var(--color-error);
}

.skeleton-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.skeleton-task {
  height: 60px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 10px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  nav {
    display: none;
  }
}
</style>
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
        </nav>
        <div class="user-info">
          <span>{{ authStore.user?.username }}</span>
          <span class="points">{{ authStore.user?.points || 0 }} 积分</span>
          <button @click="handleLogout">退出</button>
        </div>
      </div>
    </header>
    <main class="main-content">
      <div class="admin-page">
        <h1>用户管理</h1>
        <div v-if="loading" class="loading">加载中...</div>
        <div v-else-if="error" class="error">{{ error }}</div>
        <div v-else>
          <div class="users-list">
            <div v-for="user in users" :key="user.id" class="user-card glass">
              <div class="user-info">
                <div class="user-header">
                  <span class="username">{{ user.username }}</span>
                  <span v-if="user.is_admin" class="admin-badge">管理员</span>
                </div>
                <div class="user-meta">
                  <span>{{ user.email }}</span>
                  <span>注册于 {{ user.created_at }}</span>
                </div>
                <div class="user-stats">
                  <span class="points">{{ user.points }} 积分</span>
                </div>
              </div>
              <div class="user-actions">
                <button
                  v-if="user.id !== authStore.user?.id"
                  @click="deleteUser(user)"
                  class="btn-danger"
                >
                  删除用户
                </button>
                <span v-else class="self-label">当前账号</span>
              </div>
            </div>
          </div>
          <div v-if="hasMore" class="load-more">
            <button @click="loadMore">加载更多</button>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { adminApi } from '@/api'

const router = useRouter()
const authStore = useAuthStore()
const users = ref([])
const loading = ref(false)
const error = ref('')
const currentPage = ref(1)
const hasMore = ref(false)

onMounted(async () => {
  if (!authStore.user?.is_admin) {
    error.value = '无权限访问'
    return
  }
  await loadUsers()
})

async function loadUsers() {
  loading.value = true
  error.value = ''
  const res = await adminApi.getUsers({ page: 1, limit: 20 })
  loading.value = false
  if (res.success) {
    users.value = res.data.users || []
    hasMore.value = users.value.length >= 20
  } else {
    error.value = res.error?.message || '加载失败'
  }
}

async function loadMore() {
  currentPage.value++
  const res = await adminApi.getUsers({ page: currentPage.value, limit: 20 })
  if (res.success) {
    users.value.push(...(res.data.users || []))
    hasMore.value = res.data.users?.length >= 20
  }
}

async function deleteUser(user) {
  if (!confirm(`确定要删除用户"${user.username}"吗？该用户的所有数据将被永久删除。`)) return
  const res = await adminApi.deleteUser(user.id)
  if (res.success) {
    users.value = users.value.filter(u => u.id !== user.id)
  } else {
    alert(res.error?.message || '删除失败')
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
.admin-page h1 { font-size: 24px; font-weight: 600; margin-bottom: var(--space-lg); }
.loading { text-align: center; padding: var(--space-2xl); color: var(--color-secondary); }
.error { text-align: center; padding: var(--space-xl); color: var(--color-error); }
.users-list { display: flex; flex-direction: column; gap: var(--space-md); }
.user-card { padding: var(--space-lg); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.5); display: flex; justify-content: space-between; align-items: center; }
.user-header { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-xs); }
.username { font-size: 16px; font-weight: 600; }
.admin-badge { padding: 2px 8px; background: var(--color-accent); color: white; border-radius: 4px; font-size: 11px; }
.user-meta { display: flex; flex-direction: column; gap: 2px; font-size: 13px; color: var(--color-secondary); }
.user-stats { margin-top: var(--space-sm); }
.user-stats .points { color: var(--color-accent); font-weight: 600; }
.user-actions { display: flex; align-items: center; }
.btn-danger { padding: 8px 16px; background: var(--color-error); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; }
.self-label { font-size: 13px; color: var(--color-secondary); }
.load-more { text-align: center; margin-top: var(--space-lg); }
.load-more button { padding: 8px 20px; background: transparent; border: 1px solid var(--color-border); border-radius: 8px; cursor: pointer; font-size: 14px; }
</style>
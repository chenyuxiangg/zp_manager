<template>
  <div class="layout">
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
                <BaseButton
                  v-if="user.id !== authStore.user?.id"
                  variant="danger"
                  @click="askDelete(user)"
                >
                  删除用户
                </BaseButton>
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
    <!-- B0280/B0308: 用 ConfirmDialog 替代原生 confirm -->
    <ConfirmDialog
      :visible="showDeleteConfirm"
      title="确认删除用户"
      :message="deletePrompt"
      :is-danger="true"
      :loading="deleteLoading"
      confirm-text="删除"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
// v2.18: B0303 彻底化 — 走 store actions，不再 raw adminApi
import { useAdminStore } from '@/stores/admin'
import { useToast } from '@/composables/useToast'
// B0254: 用基元组件替代原始 button
import BaseButton from '@/components/base/BaseButton.vue'
// B0280/B0308: 用 ConfirmDialog 替代原生 confirm/alert
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminStore()
const toast = useToast()
// 从 store 同步本地 reactive
const users = computed(() => adminStore.users)
const loading = computed(() => adminStore.loading)
const error = computed(() => adminStore.error)
const hasMore = computed(() => adminStore.hasMore)
// B0280/B0308: ConfirmDialog 状态
const showDeleteConfirm = ref(false)
const pendingDeleteUser = ref(null)
const deleteLoading = ref(false)
const deletePrompt = computed(() =>
  pendingDeleteUser.value
    ? `确定要删除用户"${pendingDeleteUser.value.username}"吗？该用户的所有数据将被永久删除。`
    : ''
)

onMounted(async () => {
  if (!authStore.user?.is_admin) {
    return
  }
  await adminStore.fetchUsers({ page: 1, limit: 20 })
})

async function loadMore() {
  await adminStore.loadMoreUsers()
}

// B0280/B0308: 拆 askDelete / confirmDelete / cancelDelete
function askDelete(user) {
  pendingDeleteUser.value = user
  showDeleteConfirm.value = true
}
function cancelDelete() {
  showDeleteConfirm.value = false
  pendingDeleteUser.value = null
  deleteLoading.value = false
}
async function confirmDelete() {
  const user = pendingDeleteUser.value
  if (!user) return
  deleteLoading.value = true
  const res = await adminStore.deleteUser(user.id)
  deleteLoading.value = false
  if (res.success) {
    toast.success(`用户"${user.username}"已删除`)
    cancelDelete()
  } else {
    toast.error(res.error?.message || '删除失败')
    cancelDelete()
  }
}

// B0341: 删除死代码 handleLogout（改由 AppHeader/AppLayout/Settings 的 useLogout 入口触发）
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
.user-card { padding: var(--space-lg); border-radius: 12px; border: 1px solid var(--color-card-border); display: flex; justify-content: space-between; align-items: center; }
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
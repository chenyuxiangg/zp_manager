<template>
  <div class="layout">
    <main class="main-content">
      <div class="tasks-page">
        <h1>任务管理</h1>
        <div class="tabs">
          <BaseButton :variant="tab === 'today' ? 'primary' : 'secondary'" size="sm" @click="tab = 'today'">今日任务</BaseButton>
          <BaseButton :variant="tab === 'overdue' ? 'primary' : 'secondary'" size="sm" @click="tab = 'overdue'">超期任务</BaseButton>
          <BaseButton :variant="tab === 'all' ? 'primary' : 'secondary'" size="sm" @click="tab = 'all'">全部任务</BaseButton>
        </div>
        <div class="task-list">
          <BaseCard
            v-for="task in displayedTasks"
            :key="task.id"
            elevation="raised"
            padding="md"
            data-guide="task-toggle"
            @click="goToDetail(task.id)"
          >
            <div class="task-info">
              <div class="task-title">{{ task.title }}</div>
              <div class="task-meta">计划日期: {{ task.scheduled_date }} · {{ task.points }}积分</div>
            </div>

            <!-- B0302 Q3: 悬停操作 → BaseButton ghost 系列 -->
            <div class="task-actions-overlay" @click.stop>
              <BaseButton
                v-if="task.status !== 'completed'"
                variant="ghost"
                size="sm"
                @click="toggleTask(task.id)"
                title="完成"
              >✓</BaseButton>
              <BaseButton v-else variant="ghost" size="sm" @click="toggleTask(task.id)" title="撤销完成">↶</BaseButton>
              <BaseButton variant="ghost" size="sm" @click="goToDetail(task.id)" title="编辑">✎</BaseButton>
              <BaseButton variant="ghost" size="sm" @click="goToComments(task.id)" title="评论">💬</BaseButton>
              <BaseButton variant="ghost" size="sm" @click="confirmDelete(task.id)" title="删除">✕</BaseButton>
            </div>

            <!-- 已完成徽章：悬停时通过 CSS 隐藏 -->
            <span v-if="task.status === 'completed'" class="completed-badge">已完成</span>
          </BaseCard>
          <div v-if="!displayedTasks.length" class="empty-state">暂无任务</div>
        </div>
      </div>
    </main>

    <ConfirmDialog
      :visible="showDeleteConfirm"
      title="确认删除"
      message="确定要删除这个任务吗？此操作无法撤销。"
      :is-danger="true"
      @confirm="deleteTask"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
// B0302 Q3: BaseButton + BaseCard 替代 raw button/div.task-card
import BaseButton from '@/components/base/BaseButton.vue'
import BaseCard from '@/components/base/BaseCard.vue'

const router = useRouter()
const authStore = useAuthStore()
const tasksStore = useTasksStore()
const tab = ref('today')
const showDeleteConfirm = ref(false)
const deleteTaskId = ref(null)

const displayedTasks = computed(() => {
  if (tab.value === 'today') return tasksStore.todayTasks
  if (tab.value === 'overdue') return tasksStore.overdueTasks
  return tasksStore.allTasks
})

onMounted(async () => {
  await tasksStore.fetchTasks()
})

function goToDetail(taskId) {
  router.push('/tasks/' + taskId)
}

function goToComments(taskId) {
  router.push('/tasks/' + taskId + '#comments')
}

function confirmDelete(taskId) {
  deleteTaskId.value = taskId
  showDeleteConfirm.value = true
}

async function deleteTask() {
  const id = deleteTaskId.value
  showDeleteConfirm.value = false
  const res = await tasksStore.deleteTask(id)
  if (res.success) {
    await tasksStore.fetchTasks()
  }
}

async function toggleTask(taskId) {
  // 走 PATCH /toggle 统一接口（含积分回滚 + points_delta）
  const res = await tasksStore.toggleTaskComplete(taskId)
  if (res.success) {
    // 同步积分（toggle 响应中的 points_delta）
    if (authStore.user && res.data?.points_delta !== undefined) {
      authStore.user.points = Math.max(0, (authStore.user.points || 0) + res.data.points_delta)
    }
    await tasksStore.fetchTasks()
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
.main-content { max-width: 1200px; margin: 0 auto; padding: var(--space-xl) var(--space-lg); }
.tasks-page h1 { font-size: 24px; font-weight: 600; margin-bottom: var(--space-lg); }
.tabs { display: flex; gap: var(--space-sm); margin-bottom: var(--space-lg); }
.tabs button { padding: 8px 16px; border: 1px solid var(--color-border); background: white; border-radius: 8px; cursor: pointer; font-size: 14px; }
.tabs button.active { background: var(--color-accent); color: white; border-color: var(--color-accent); }
.task-list { display: flex; flex-direction: column; gap: var(--space-sm); }

/* 任务卡片：相对定位以容纳覆盖层 */
.task-card {
  position: relative;
  overflow: hidden;
  padding: var(--space-md);
  border-radius: 10px;
  border: 1px solid var(--color-card-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: box-shadow 0.2s ease;
}
.task-title { font-weight: 500; margin-bottom: 4px; }
.task-meta { font-size: 13px; color: var(--color-secondary); }
.completed-badge { color: var(--color-success); font-size: 13px; font-weight: 500; transition: opacity 0.2s ease; }
.empty-state { text-align: center; padding: var(--space-xl); color: var(--color-secondary); }

/* 悬停操作覆盖层：默认隐藏 */
.task-actions-overlay {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}
.task-card:hover .task-actions-overlay {
  opacity: 1;
  pointer-events: auto;
}
/* 悬停时隐藏徽章（避免与覆盖层重叠） */
.task-card:hover .completed-badge {
  opacity: 0;
}

.task-actions-overlay button {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.15s ease;
}
.task-actions-overlay button:hover {
  background: var(--color-surface);
  border-color: var(--color-accent);
  color: var(--color-accent);
}
.task-actions-overlay .action-danger:hover {
  background: var(--color-error);
  border-color: var(--color-error);
  color: white;
}

/* 移动端：hover 不可用，操作按钮始终显示 */
@media (hover: none) {
  .task-actions-overlay {
    opacity: 1;
    pointer-events: auto;
  }
  .task-card .completed-badge {
    opacity: 0;
  }
}
</style>

<template>
  <div class="layout">
    <main class="main-content">
      <div class="task-detail" v-if="task">
        <!-- 面包屑 + 返回按钮（路由栈式返回） -->
        <div class="breadcrumb-bar">
          <BaseButton class="back-btn" variant="ghost" size="sm" @click="goBack" title="返回任务列表">← 返回</BaseButton>
          <Breadcrumb :crumbs="[{ label: '任务', path: '/tasks' }, { label: task.title, path: null }]" />
        </div>

        <!-- 任务主体 -->
        <div class="task-header glass">
          <div class="task-info">
            <h1 v-if="!editing">{{ task.title }}</h1>
            <input v-else v-model="editForm.title" class="title-input" />
            <div class="task-meta">
              <span>计划日期: {{ task.scheduled_date }}</span>
              <span :class="'status-' + task.status">{{ statusText(task.status) }}</span>
              <span v-if="task.points">{{ task.points }} 积分</span>
              <span v-if="task.plan">所属计划: {{ task.plan.title }}</span>
            </div>
          </div>
          <div class="task-actions">
            <BaseButton
              variant="secondary"
              @click="toggleComplete"
              :disabled="loading"
            >
              {{ task.status === 'completed' ? '标记未完成' : '标记完成' }}
            </BaseButton>
            <BaseButton v-if="!editing" variant="secondary" @click="startEdit" :disabled="loading">编辑</BaseButton>
            <template v-else>
              <BaseButton variant="primary" @click="saveEdit" :disabled="loading">保存</BaseButton>
              <BaseButton variant="secondary" @click="cancelEdit">取消</BaseButton>
            </template>
            <BaseButton variant="danger" @click="showDeleteConfirm = true" :disabled="loading">删除</BaseButton>
          </div>
        </div>

        <!-- B0299: Pomodoro 专注区 (核心产品功能) -->
        <BaseCard elevation="raised" padding="md" class="pomodoro-section" data-guide="pomodoro-start">
          <h3>专注</h3>
          <PomodoroStartButton
            :running="pomodoroRunning"
            :starting="pomodoroStarting"
            @start="startPomodoro"
            @stop="stopPomodoro"
          />
          <PomodoroTimer
            v-if="pomodoroRunning"
            :duration="pomodoroMinutes * 60"
            :auto-toggle="pomodoroAutoToggle"
            @complete="onPomodoroComplete"
          />
          <PomodoroHistoryList :sessions="pomodoroSessions" />
        </BaseCard>

        <!-- 描述区 -->
        <div class="task-description glass">
          <h3>描述</h3>
          <div v-if="!editing" class="description-content">
            <div v-if="task.description" v-html="sanitizeHtml(task.description)"></div>
            <p v-else class="empty-text">暂无描述</p>
          </div>
          <textarea
            v-else
            v-model="editForm.description"
            class="description-textarea"
            placeholder="添加描述..."
            rows="4"
          />
        </div>

        <!-- 评论区 -->
        <div class="task-comments glass">
          <h3>评论 ({{ comments.length }})</h3>
          <div class="comment-list">
            <CommentItem
              v-for="comment in comments"
              :key="comment.id"
              :comment="comment"
              @edit="(payload) => handleCommentEdit(payload.commentId, payload.content)"
              @delete="(commentId) => handleCommentDelete(commentId)"
            />
            <p v-if="comments.length === 0" class="empty-text">暂无评论</p>
          </div>
          <div class="comment-editor">
            <QuillEditor v-model:content="newComment" contentType="html" theme="snow" />
            <BaseButton variant="primary" @click="submitComment" :disabled="loading">发送评论</BaseButton>
          </div>
        </div>
      </div>
      <p v-else>加载中...</p>
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
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Breadcrumb from '@/components/common/Breadcrumb.vue'
import CommentItem from '@/components/common/CommentItem.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
// B0254: 用基元组件替代原始 button
import BaseButton from '@/components/base/BaseButton.vue'
// B0299: Pomodoro 3 组件
import BaseCard from '@/components/base/BaseCard.vue'
import PomodoroStartButton from '@/components/pomodoro/PomodoroStartButton.vue'
import PomodoroTimer from '@/components/pomodoro/PomodoroTimer.vue'
import PomodoroHistoryList from '@/components/pomodoro/PomodoroHistoryList.vue'
import { QuillEditor } from '@vueup/vue-quill'
import { useTasksStore } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { useApiResponse } from '@/composables/useApiResponse'
import { useDraft } from '@/composables/useDraft'
import { useBackNavigation } from '@/composables/useBackNavigation'
// B0292: XSS 防御 — sanitizeHtml 用于 v-html 前置过滤
import { sanitizeHtml } from '@/utils/sanitize'

const route = useRoute()
const router = useRouter()
const tasksStore = useTasksStore()
const authStore = useAuthStore()
const { handleSuccess, handleError } = useApiResponse()
const { handleBack } = useBackNavigation('/tasks')

const taskId = route.params.id
const task = ref(null)
const comments = ref([])
const editing = ref(false)
const showDeleteConfirm = ref(false)
const newComment = ref('')
const editForm = ref({ title: '', description: '' })
const loading = ref(false)

// B0299: Pomodoro state (核心产品功能)
const pomodoroRunning = ref(false)
const pomodoroStarting = ref(false)
const pomodoroSessions = ref([])
const pomodoroMinutes = 25  // 默认 25min
// B0325: 改 ref 让 UI 切换；PR0021 纯计时默认 false
const pomodoroAutoToggle = ref(false)
// B0312: 保存当前活跃 pomodoro session_id（end URL 必传）
const currentPomodoroSessionId = ref(null)

async function startPomodoro() {
  pomodoroStarting.value = true
  try {
    // B0313: 发 planned_minutes（分钟），与后端 PomodoroSession.planned_minutes 字段对齐
    const res = await api.post(
      `/tasks/${taskId}/pomodoro/start`,
      { planned_minutes: pomodoroMinutes }
    )
    if (res.success) {
      pomodoroRunning.value = true
      // B0312: 捕获并保存 session_id，供 stopPomodoro URL 拼接
      currentPomodoroSessionId.value = res?.data?.session_id || null
      // B0313: 兜底同步后端权威 planned_minutes（校验后值）
      if (res?.data?.planned_minutes && res.data.planned_minutes !== pomodoroMinutes) {
        pomodoroMinutes = res.data.planned_minutes
      }
      handleSuccess('专注已开始')
    }
  } catch (e) {
    handleError(e)
  } finally {
    pomodoroStarting.value = false
  }
}
async function stopPomodoro(earlyEnd = false) {
  // B0312: 无 session_id 不调 API（防御）
  if (!currentPomodoroSessionId.value) {
    handleError(new Error('无活跃的专注 session，请先点击"开始专注"'))
    return
  }
  try {
    // B0325: body 必传 early_end + auto_toggle（PR0008 联动版依赖）
    const res = await api.post(
      `/tasks/${taskId}/pomodoro/${currentPomodoroSessionId.value}/end`,
      {
        early_end: earlyEnd,
        auto_toggle: pomodoroAutoToggle.value,
        duration: pomodoroMinutes * 60,
      }
    )
    if (res.success) {
      pomodoroRunning.value = false
      currentPomodoroSessionId.value = null
      // B0315 修复: end 后刷新历史列表，新结束的 session 应出现在 PomodoroHistoryList
      await fetchPomodoroSessions()
      handleSuccess('专注已结束')
    }
  } catch (e) {
    handleError(e)
  }
}
async function onPomodoroComplete() {
  // B0325: 倒计时归零不调 API（只切 UI 状态），PR0008 联动版在 stopPomodoro 路径生效
  pomodoroRunning.value = false
  handleSuccess(pomodoroAutoToggle.value
    ? '已完成 25 分钟专注 + 任务已自动完成'
    : '已完成 25 分钟专注')
}

// B0315 修复: 重命名为 fetchPomodoroSessions（既查 active session 也回填历史）
// B0312: 恢复 active pomodoro session（跨设备/刷新场景）
async function fetchPomodoroSessions() {
  try {
    const res = await api.get(`/tasks/${taskId}/pomodoros`)
    if (res.success) {
      const sessions = res?.data?.sessions || []
      // 1. 回填历史列表（PomodoroHistoryList 显示）
      pomodoroSessions.value = sessions
      // 2. 恢复 active session（跨设备/刷新场景）
      const active = sessions.find(s => !s.ended_at)
      if (active) {
        currentPomodoroSessionId.value = active.id
        pomodoroRunning.value = true
      }
    }
  } catch {
    // sessions 接口缺失/失败时静默，不影响主流程
  }
}

// 草稿：使用 watchDraft 自动防抖保存
const { loadDraft, clearDraft, watchDraft } = useDraft(`task-${taskId}`, editForm)

function statusText(status) {
  return {
    pending: '待完成',
    in_progress: '进行中',
    completed: '已完成',
    overdue: '已过期'
  }[status] || status
}

// 路由栈式返回（useBackNavigation 提供）
function goBack() {
  handleBack()
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

onMounted(async () => {
  const [detailRes, commentsRes] = await Promise.all([
    tasksStore.fetchTaskDetail(taskId),
    tasksStore.fetchTaskComments(taskId)
  ])
  if (detailRes.success) {
    task.value = tasksStore.currentTask
    editForm.value = {
      title: task.value.title,
      description: task.value.description || ''
    }
  }
  if (commentsRes.success) {
    comments.value = tasksStore.taskComments
  }
  // B0315: 加载历史 + 恢复 active session（统一入口 fetchPomodoroSessions）
  fetchPomodoroSessions()
  if (route.query.edit === '1') editing.value = true
})

async function toggleComplete() {
  loading.value = true
  const res = await tasksStore.toggleTaskComplete(taskId)
  loading.value = false
  if (res.success) {
    task.value = tasksStore.currentTask
    // 同步积分（toggle 返回 points_delta）
    if (authStore.user && res.data?.points_delta !== undefined) {
      authStore.user.points = Math.max(0, (authStore.user.points || 0) + res.data.points_delta)
    }
    handleSuccess(task.value.status === 'completed' ? '任务已完成' : '任务已恢复')
  } else {
    handleError(res)
  }
}

function startEdit() {
  // 优先恢复历史草稿（防刷新丢稿），无草稿则使用任务原始值
  const draft = loadDraft()
  editForm.value = draft || {
    title: task.value.title,
    description: task.value.description || ''
  }
  // 启动自动防抖保存
  watchDraft(editForm, { debounceMs: 2000 })
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  // 取消即丢弃草稿，恢复为任务原始值
  clearDraft()
  editForm.value = {
    title: task.value.title,
    description: task.value.description || ''
  }
}

async function saveEdit() {
  loading.value = true
  const res = await tasksStore.updateTask(taskId, editForm.value)
  loading.value = false
  if (res.success) {
    task.value = { ...task.value, ...editForm.value }
    editing.value = false
    clearDraft()
    handleSuccess('保存成功')
  } else {
    handleError(res)
  }
}

async function deleteTask() {
  loading.value = true
  const res = await tasksStore.deleteTask(taskId)
  loading.value = false
  showDeleteConfirm.value = false
  if (res.success) {
    handleSuccess('任务已删除')
    router.push('/tasks')
  } else {
    handleError(res)
  }
}

async function handleCommentEdit(commentId, content) {
  const res = await tasksStore.updateComment(taskId, commentId, content)
  if (res.success) {
    const idx = comments.value.findIndex(c => c.id === commentId)
    // 用后端返回的完整 comment 替换（含 updated_at），避免 UI 看不到"已编辑"标识
    if (idx > -1 && res.data?.comment) {
      comments.value[idx] = res.data.comment
    }
    handleSuccess('评论已更新')
  } else {
    handleError(res)
  }
}

async function handleCommentDelete(commentId) {
  const res = await tasksStore.deleteComment(taskId, commentId)
  if (res.success) {
    comments.value = comments.value.filter(c => c.id !== commentId)
    handleSuccess('评论已删除')
  } else {
    handleError(res)
  }
}

async function submitComment() {
  if (!newComment.value || !newComment.value.trim()) return
  const res = await tasksStore.addComment(taskId, newComment.value)
  if (res.success) {
    if (res.data?.comment) {
      comments.value.push(res.data.comment)
    }
    newComment.value = ''
    handleSuccess('评论已发送')
  } else {
    handleError(res)
  }
}
</script>

<style scoped>
/* ==================== Header（与其他页面保持一致） ==================== */
.layout { min-height: 100vh; background: var(--color-surface); }
.header { position: sticky; top: 0; border-bottom: 1px solid var(--color-border); z-index: 10; }
.header-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-lg);
  height: 56px;
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}
.logo { font-size: 20px; font-weight: 700; color: var(--color-primary, #000); }
nav { display: flex; gap: var(--space-md); flex: 1; }
nav a {
  color: var(--color-secondary, #6e6e73);
  text-decoration: none;
  font-size: 14px;
}
nav a:hover, nav a.router-link-active { color: var(--color-primary, #000); }
.user-info {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  font-size: 14px;
}
.points { color: var(--color-accent, #0071e3); font-weight: 600; }
.user-info button {
  padding: 6px 12px;
  border: 1px solid var(--color-border, #d2d2d7);
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

/* ==================== Main content ==================== */
.main-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-lg);
}

.task-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back-btn {
  padding: 6px 12px;
  border: 1px solid var(--color-border, #d2d2d7);
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: var(--color-secondary, #6e6e73);
  transition: all 0.15s ease;
}
.back-btn:hover {
  border-color: var(--color-accent, #0071e3);
  color: var(--color-accent, #0071e3);
}

.task-header,
.task-description,
.task-comments {
  padding: 24px;
  border-radius: 12px;
}

.task-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-info h1 {
  margin: 0 0 12px;
  font-size: 24px;
  color: var(--color-primary, #000);
}

.title-input {
  width: 100%;
  font-size: 24px;
  padding: 4px 8px;
  border: 1px solid var(--color-border, #d2d2d7);
  border-radius: 6px;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  color: var(--color-secondary, #6e6e73);
  font-size: 14px;
}

.task-meta .status-pending { color: var(--color-warning, #f59e0b); }
.task-meta .status-completed { color: var(--color-success, #10b981); }
.task-meta .status-overdue { color: var(--color-error, #ef4444); }

.task-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

/* 按钮统一样式（补全局 button-states.css 缺失部分） */
.task-actions button {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.task-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--color-accent, #0071e3);
  color: white;
  border: none;
}
.btn-primary:hover:not(:disabled) {
  background: var(--color-accent, #0071e3);
  opacity: 0.9;
}

.btn-secondary {
  background: white;
  border: 1px solid var(--color-border, #d2d2d7);
  color: var(--color-primary, #000);
}
.btn-secondary:hover:not(:disabled) {
  background: var(--color-surface, #f5f5f7);
  border-color: var(--color-secondary, #6e6e73);
}

.btn-danger {
  background: var(--color-error, #ff3b30);
  color: white;
  border: none;
}
.btn-danger:hover:not(:disabled) {
  opacity: 0.9;
}

.description-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border, #d2d2d7);
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
}

.description-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-primary, #000);
}

.empty-text {
  color: var(--color-secondary, #6e6e73);
  font-style: italic;
  margin: 0;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.comment-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.comment-editor .btn-primary {
  align-self: flex-end;
  padding: 8px 20px;
  font-size: 14px;
  background: var(--color-accent, #0071e3);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}
.comment-editor .btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 移动端适配：标题+操作按钮垂直堆叠，避免按钮溢出 */
@media (max-width: 640px) {
  .task-header {
    flex-direction: column;
    align-items: stretch;
  }
  .task-actions {
    flex-wrap: wrap;
  }
  .task-actions button {
    flex: 1;
    min-width: 120px;
  }
  .breadcrumb-bar {
    flex-wrap: wrap;
  }
}
</style>

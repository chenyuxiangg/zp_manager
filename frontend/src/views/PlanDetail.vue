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
      <div class="plan-detail" v-if="plan">
        <div class="page-header">
          <div class="plan-info">
            <button class="back-btn" @click="$router.push('/plans')">← 返回</button>
            <div>
              <h1>{{ plan.title }}</h1>
              <p class="description">{{ plan.description }}</p>
              <div class="plan-meta">
                <span>{{ plan.start_date }} ~ {{ plan.end_date }}</span>
                <span :class="'status-' + plan.status">{{ plan.status }}</span>
              </div>
            </div>
          </div>
          <div class="plan-actions">
            <button class="btn-secondary" @click="exportAsTemplate">导出为模板</button>
            <button class="btn-danger" @click="deletePlan">删除计划</button>
            <button class="btn-secondary" @click="showEditPlan = true">编辑计划</button>
          </div>
        </div>

        <div class="stages-section">
          <div class="section-header">
            <h2>阶段</h2>
            <button class="btn-primary" @click="showCreateStage = true">添加阶段</button>
          </div>

          <div v-if="stages.length" class="stages-list">
            <div v-for="stage in stages" :key="stage.id" class="stage-card glass">
              <div class="stage-header">
                <div class="stage-info">
                  <span class="stage-order">阶段 {{ stage.order_num + 1 }}</span>
                  <h3>{{ stage.title }}</h3>
                </div>
                <div class="stage-actions">
                  <button @click="editStage(stage)">编辑</button>
                  <button @click="deleteStage(stage.id)">删除</button>
                </div>
              </div>
              <p class="stage-desc">{{ stage.description }}</p>
              <div class="stage-meta">
                <span>{{ stage.start_date }} ~ {{ stage.end_date }}</span>
                <span :class="'status-' + stage.status">{{ stage.status }}</span>
              </div>

              <div class="tasks-section">
                <div class="tasks-header">
                  <span>任务</span>
                  <button @click="openCreateTaskModal(stage)">添加任务</button>
                </div>
                <div v-if="getStageTasks(stage.id).length" class="tasks-list">
                  <div v-for="task in getStageTasks(stage.id)" :key="task.id" class="task-item">
                    <div class="task-info">
                      <span class="task-title">{{ task.title }}</span>
                      <span class="task-points">{{ task.points }}分</span>
                    </div>
                    <div v-if="task.description" class="task-desc" v-html="task.description"></div>
                    <div class="task-meta">
                      <span>{{ task.scheduled_date }}</span>
                      <span :class="'status-' + task.status">{{ task.status }}</span>
                    </div>
                    <div class="task-actions">
                      <button v-if="task.status !== 'completed'" @click="completeTask(task.id)">完成</button>
                      <button @click="editTask(task, stage)">编辑</button>
                      <button @click="toggleComments(task.id)">验收评论</button>
                      <button @click="deleteTask(task.id)">删除</button>
                    </div>
                    <!-- 评论区 -->
                    <div v-if="activeCommentTask === task.id" class="comment-panel">
                      <div class="comment-list">
                        <div v-for="c in taskComments[task.id]" :key="c.id" class="comment-item">
                          <div class="comment-body">
                            <div class="comment-actions">
                              <button @click="startEditComment(task.id, c)" class="btn-link">编辑</button>
                              <button @click="removeComment(task.id, c.id)" class="btn-link btn-danger">删除</button>
                            </div>
                            <div class="comment-content" v-html="c.content"></div>
                            <div class="comment-time">{{ c.created_at }}</div>
                          </div>
                          <div v-if="editingComment === c.id" class="edit-comment-form">
                            <div class="editor-wrapper">
                              <QuillEditor v-model:content="editCommentContent" contentType="html" theme="snow" toolbar="minimal" />
                            </div>
                            <div class="edit-actions">
                              <button @click="cancelEditComment">取消</button>
                              <button @click="saveEditComment(task.id, c.id)" class="btn-primary">保存</button>
                            </div>
                          </div>
                        </div>
                        <div v-if="!taskComments[task.id]?.length" class="empty-comments">暂无评论</div>
                      </div>
                      <div class="comment-input">
                        <div class="editor-wrapper">
                          <QuillEditor v-model:content="newComments[task.id]" contentType="html" theme="snow" toolbar="minimal" />
                        </div>
                        <button @click="submitComment(task.id)">提交</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="empty-tasks">暂无任务</div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">暂无阶段，请添加第一个阶段</div>
        </div>
      </div>
      <div v-else class="loading">加载中...</div>
    </main>

    <!-- Create Stage Modal -->
    <div v-if="showCreateStage" class="modal" @click.self="showCreateStage = false">
      <div class="modal-content glass">
        <h2>添加阶段</h2>
        <form @submit.prevent="createStage">
          <div class="form-group">
            <label>阶段名称</label>
            <input v-model="newStage.title" required />
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="newStage.description"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>开始日期</label>
              <input v-model="newStage.start_date" type="date" required />
            </div>
            <div class="form-group">
              <label>结束日期</label>
              <input v-model="newStage.end_date" type="date" required />
            </div>
          </div>
          <div class="form-actions">
            <button type="button" @click="showCreateStage = false">取消</button>
            <button type="submit">创建</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Stage Modal -->
    <div v-if="showEditStage" class="modal" @click.self="showEditStage = false">
      <div class="modal-content glass">
        <h2>编辑阶段</h2>
        <form @submit.prevent="updateStage">
          <div class="form-group">
            <label>阶段名称</label>
            <input v-model="editStageData.title" required />
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="editStageData.description"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>开始日期</label>
              <input v-model="editStageData.start_date" type="date" required />
            </div>
            <div class="form-group">
              <label>结束日期</label>
              <input v-model="editStageData.end_date" type="date" required />
            </div>
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="editStageData.status">
              <option value="pending">待开始</option>
              <option value="in_progress">进行中</option>
              <option value="completed">已完成</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" @click="showEditStage = false">取消</button>
            <button type="submit">保存</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Create Task Modal -->
    <div v-if="showCreateTask" class="modal" @click.self="closeTaskModal">
      <div class="modal-content glass">
        <h2>添加任务</h2>
        <form @submit.prevent="createTask">
          <div class="form-group">
            <label>任务名称</label>
            <input v-model="newTask.title" required />
          </div>
          <div class="form-group">
            <label>描述</label>
            <div class="editor-wrapper">
              <QuillEditor v-model:content="newTask.description" contentType="html" theme="snow" toolbar="minimal" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>截止日期</label>
              <input v-model="newTask.scheduled_date" type="date" required />
            </div>
            <div class="form-group">
              <label>积分</label>
              <input v-model.number="newTask.points" type="number" min="1" />
            </div>
          </div>
          <div class="form-actions">
            <button type="button" @click="closeTaskModal">取消</button>
            <button type="submit">创建</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Task Modal -->
    <div v-if="showEditTask" class="modal" @click.self="showEditTask = false">
      <div class="modal-content glass">
        <h2>编辑任务</h2>
        <form @submit.prevent="updateTask">
          <div class="form-group">
            <label>任务名称</label>
            <input v-model="editTaskData.title" required />
          </div>
          <div class="form-group">
            <label>描述</label>
            <div class="editor-wrapper">
              <QuillEditor v-model:content="editTaskData.description" contentType="html" theme="snow" toolbar="minimal" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>截止日期</label>
              <input v-model="editTaskData.scheduled_date" type="date" required />
            </div>
            <div class="form-group">
              <label>积分</label>
              <input v-model.number="editTaskData.points" type="number" min="1" />
            </div>
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="editTaskData.status">
              <option value="pending">待完成</option>
              <option value="in_progress">进行中</option>
              <option value="completed">已完成</option>
              <option value="overdue">已超期</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" @click="showEditTask = false">取消</button>
            <button type="submit">保存</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Plan Modal -->
    <div v-if="showEditPlan" class="modal" @click.self="showEditPlan = false">
      <div class="modal-content glass">
        <h2>编辑计划</h2>
        <form @submit.prevent="updatePlan">
          <div class="form-group">
            <label>计划名称</label>
            <input v-model="editPlanData.title" required />
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="editPlanData.description"></textarea>
          </div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="editPlanData.status">
              <option value="active">进行中</option>
              <option value="completed">已完成</option>
              <option value="archived">已归档</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" @click="showEditPlan = false">取消</button>
            <button type="submit">保存</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import api from '@/api'
import { commentApi } from '@/api'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const plan = ref(null)
const stages = ref([])
const tasks = ref([])

const showCreateStage = ref(false)
const showEditStage = ref(false)
const showCreateTask = ref(false)
const showEditTask = ref(false)
const showEditPlan = ref(false)

const newStage = ref({ title: '', description: '', start_date: '', end_date: '' })
const editStageData = ref({ id: null, title: '', description: '', start_date: '', end_date: '', status: 'pending' })

const newTask = ref({ title: '', description: '', scheduled_date: '', points: 10, stage_id: null })
const editTaskData = ref({ id: null, title: '', description: '', scheduled_date: '', points: 10, status: 'pending' })

const editPlanData = ref({ title: '', description: '', status: 'active' })

// 评论相关
const activeCommentTask = ref(null)
const taskComments = ref({})
const newComments = ref({})
const editingComment = ref(null)
const editCommentContent = ref('')

const planId = computed(() => route.params.id)

function getStageTasks(stageId) {
  return tasks.value.filter(t => t.stage_id === stageId)
}

async function loadPlanDetail() {
  const res = await api.get(`/plans/${planId.value}`)
  if (res.success) {
    plan.value = res.data.plan
    stages.value = res.data.stages || []
    tasks.value = res.data.tasks || []
    editPlanData.value = { title: plan.value.title, description: plan.value.description, status: plan.value.status }
  }
}

async function createStage() {
  try {
    const res = await api.post(`/plans/${planId.value}/stages`, {
      title: newStage.value.title,
      description: newStage.value.description,
      start_date: newStage.value.start_date,
      end_date: newStage.value.end_date,
      order_num: stages.value.length
    })
    if (res.success) {
      showCreateStage.value = false
      newStage.value = { title: '', description: '', start_date: '', end_date: '' }
      await loadPlanDetail()
    } else {
      alert(res.error?.message || '创建失败')
    }
  } catch (e) {
    alert(e?.response?.data?.error?.message || '创建失败')
  }
}

function editStage(stage) {
  editStageData.value = {
    id: stage.id,
    title: stage.title,
    description: stage.description,
    start_date: stage.start_date,
    end_date: stage.end_date,
    status: stage.status
  }
  showEditStage.value = true
}

async function updateStage() {
  try {
    const res = await api.put(`/stages/${editStageData.value.id}`, {
      title: editStageData.value.title,
      description: editStageData.value.description,
      status: editStageData.value.status
    })
    if (res.success) {
      showEditStage.value = false
      await loadPlanDetail()
    } else {
      alert(res.error?.message || '更新失败')
    }
  } catch (e) {
    alert(e?.response?.data?.error?.message || '更新失败')
  }
}

async function deleteStage(stageId) {
  if (!confirm('确定要删除这个阶段吗？阶段下的所有任务也会被删除。')) return
  const res = await api.delete(`/stages/${stageId}`)
  if (res.success) {
    await loadPlanDetail()
  }
}

function openCreateTaskModal(stage) {
  newTask.value = { title: '', description: '', scheduled_date: '', points: 10, stage_id: stage.id }
  showCreateTask.value = true
}

function editTask(task, stage) {
  editTaskData.value = {
    id: task.id,
    title: task.title,
    description: task.description,
    scheduled_date: task.scheduled_date,
    points: task.points,
    status: task.status,
    stage_id: stage.id
  }
  showEditTask.value = true
}

async function createTask() {
  try {
    const res = await api.post(`/stages/${newTask.value.stage_id}/tasks`, {
      title: newTask.value.title,
      description: newTask.value.description,
      scheduled_date: newTask.value.scheduled_date,
      points: newTask.value.points
    })
    if (res.success) {
      showCreateTask.value = false
      await loadPlanDetail()
    } else {
      alert(res.error?.message || '创建失败')
    }
  } catch (e) {
    alert(e?.response?.data?.error?.message || '创建失败')
  }
}

async function updateTask() {
  try {
    const res = await api.put(`/tasks/${editTaskData.value.id}`, {
      title: editTaskData.value.title,
      description: editTaskData.value.description,
      scheduled_date: editTaskData.value.scheduled_date,
      status: editTaskData.value.status
    })
    if (res.success) {
      showEditTask.value = false
      await loadPlanDetail()
    } else {
      alert(res.error?.message || '更新失败')
    }
  } catch (e) {
    alert(e?.response?.data?.error?.message || '更新失败')
  }
}

async function completeTask(taskId) {
  const res = await api.put(`/tasks/${taskId}/complete`)
  if (res.success) {
    await loadPlanDetail()
    await authStore.fetchUser()
  }
}

async function deleteTask(taskId) {
  if (!confirm('确定要删除这个任务吗？')) return
  const res = await api.delete(`/tasks/${taskId}`)
  if (res.success) {
    await loadPlanDetail()
  }
}

async function deletePlan() {
  if (!confirm('确定要删除这个计划吗？所有阶段和任务都会被删除。')) return
  const res = await api.delete(`/plans/${planId.value}`)
  if (res.success) {
    router.push('/plans')
  }
}

async function exportAsTemplate() {
  try {
    const res = await api.post('/plan-templates', { plan_id: planId.value })
    if (res.success) {
      alert('已导出为模板')
    } else {
      alert(res.error?.message || '导出失败')
    }
  } catch (e) {
    alert(e?.response?.data?.error?.message || '导出失败')
  }
}

async function updatePlan() {
  try {
    const res = await api.put(`/plans/${planId.value}`, {
      title: editPlanData.value.title,
      description: editPlanData.value.description,
      status: editPlanData.value.status
    })
    if (res.success) {
      showEditPlan.value = false
      await loadPlanDetail()
    } else {
      alert(res.error?.message || '更新失败')
    }
  } catch (e) {
    alert(e?.response?.data?.error?.message || '更新失败')
  }
}

function closeTaskModal() {
  showCreateTask.value = false
}

async function toggleComments(taskId) {
  if (activeCommentTask.value === taskId) {
    activeCommentTask.value = null
    return
  }
  activeCommentTask.value = taskId
  if (!taskComments.value[taskId]) {
    const res = await commentApi.getComments(taskId)
    if (res.success) {
      taskComments.value[taskId] = res.data.comments || []
    }
  }
}

async function submitComment(taskId) {
  const content = newComments.value[taskId]?.trim()
  if (!content) return
  const res = await commentApi.addComment(taskId, content)
  if (res.success) {
    taskComments.value[taskId] = [...(taskComments.value[taskId] || []), res.data.comment]
    newComments.value[taskId] = ''
    activeCommentTask.value = null
    await nextTick()
    activeCommentTask.value = taskId
    await authStore.fetchUser()
  }
}

function startEditComment(taskId, comment) {
  editingComment.value = comment.id
  editCommentContent.value = comment.content
}

function cancelEditComment() {
  editingComment.value = null
  editCommentContent.value = ''
}

async function saveEditComment(taskId, commentId) {
  const content = editCommentContent.value?.trim()
  if (!content) return
  const res = await commentApi.updateComment(taskId, commentId, content)
  if (res.success) {
    const comments = taskComments.value[taskId]
    const idx = comments.findIndex(c => c.id === commentId)
    if (idx !== -1) {
      comments[idx] = { ...comments[idx], content: res.data.comment.content }
      taskComments.value[taskId] = [...comments]
    }
    editingComment.value = null
    editCommentContent.value = ''
  }
}

async function removeComment(taskId, commentId) {
  if (!confirm('确定要删除这条评论吗？')) return
  const res = await commentApi.deleteComment(taskId, commentId)
  if (res.success) {
    taskComments.value[taskId] = taskComments.value[taskId].filter(c => c.id !== commentId)
  }
}

async function handleLogout() {
  await authStore.logout()
  router.push('/login')
}

onMounted(() => {
  loadPlanDetail()
})
</script>

<style scoped>
.layout { min-height: 100vh; background: var(--color-surface); }
.header { position: sticky; top: 0; border-bottom: 1px solid var(--color-border); }
.header-content { max-width: 1200px; margin: 0 auto; padding: 0 var(--space-lg); height: 56px; display: flex; align-items: center; gap: var(--space-lg); }
.logo { font-size: 20px; font-weight: 700; }
nav { display: flex; gap: var(--space-md); flex: 1; }
nav a { color: var(--color-secondary); text-decoration: none; font-size: 14px; transition: color 0.2s; }
nav a:hover, nav a.router-link-active { color: var(--color-primary); }
.user-info { display: flex; align-items: center; gap: var(--space-md); font-size: 14px; }
.points { color: var(--color-accent); font-weight: 600; }
.user-info button { padding: 6px 12px; border: 1px solid var(--color-border); background: transparent; border-radius: 6px; cursor: pointer; font-size: 13px; }
.main-content { max-width: 1200px; margin: 0 auto; padding: var(--space-xl) var(--space-lg); }

.page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-xl); }
.plan-info { display: flex; gap: var(--space-md); align-items: flex-start; }
.back-btn { padding: 8px 16px; background: transparent; border: 1px solid var(--color-border); border-radius: 8px; cursor: pointer; font-size: 14px; }
.plan-info h1 { font-size: 24px; font-weight: 600; margin-bottom: var(--space-xs); }
.description { color: var(--color-secondary); font-size: 14px; margin-bottom: var(--space-sm); }
.plan-meta { display: flex; gap: var(--space-md); font-size: 13px; color: var(--color-secondary); }
.plan-actions { display: flex; gap: var(--space-sm); }

.stages-section { margin-top: var(--space-xl); }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); }
.section-header h2 { font-size: 18px; font-weight: 600; }
.btn-primary { padding: 8px 16px; background: var(--color-accent); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
.btn-secondary { padding: 8px 16px; background: transparent; border: 1px solid var(--color-border); border-radius: 8px; cursor: pointer; font-size: 14px; }
.btn-danger { padding: 8px 16px; background: var(--color-error); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }

.stages-list { display: flex; flex-direction: column; gap: var(--space-lg); }
.stage-card { padding: var(--space-lg); border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.5); }
.stage-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-sm); }
.stage-info { display: flex; flex-direction: column; gap: 4px; }
.stage-order { font-size: 12px; color: var(--color-accent); font-weight: 600; }
.stage-info h3 { font-size: 16px; font-weight: 600; }
.stage-actions { display: flex; gap: var(--space-xs); }
.stage-actions button { padding: 4px 8px; background: transparent; border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; font-size: 12px; }
.stage-desc { font-size: 13px; color: var(--color-secondary); margin-bottom: var(--space-sm); }
.stage-meta { display: flex; gap: var(--space-md); font-size: 12px; color: var(--color-secondary); margin-bottom: var(--space-md); }

.tasks-section { margin-top: var(--space-md); padding-top: var(--space-md); border-top: 1px solid var(--color-border); }
.tasks-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-sm); font-size: 14px; font-weight: 500; }
.tasks-header button { padding: 4px 8px; background: var(--color-accent); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }

.tasks-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.task-item { display: flex; flex-direction: column; gap: var(--space-xs); padding: var(--space-sm) var(--space-md); background: rgba(0, 0, 0, 0.02); border-radius: 8px; }
.task-info { display: flex; gap: var(--space-md); align-items: center; }
.task-title { font-size: 14px; }
.task-points { font-size: 12px; color: var(--color-accent); }
.task-desc { font-size: 12px; color: var(--color-secondary); padding: 4px 0; }
.task-desc a { color: var(--color-accent); }
.task-desc img { max-width: 100%; height: auto; }
.task-meta { display: flex; gap: var(--space-md); font-size: 12px; color: var(--color-secondary); }
.task-actions { display: flex; gap: var(--space-xs); }
.task-actions button { padding: 4px 8px; background: transparent; border: 1px solid var(--color-border); border-radius: 4px; cursor: pointer; font-size: 11px; }
.task-actions button:nth-child(3) { background: var(--color-accent); color: white; border: none; }

.comment-panel { margin-top: var(--space-md); padding: var(--space-md); background: var(--color-surface); border-radius: 8px; }
.comment-list { display: flex; flex-direction: column; gap: var(--space-sm); margin-bottom: var(--space-md); max-height: 200px; overflow-y: auto; }
.comment-item { padding: var(--space-sm); background: white; border-radius: 6px; position: relative; }
.comment-item:hover .comment-actions { opacity: 1; }
.comment-body { }
.comment-actions { position: absolute; top: var(--space-sm); right: var(--space-sm); display: flex; gap: var(--space-sm); opacity: 0; transition: opacity 0.2s; }
.comment-actions .btn-link { padding: 2px 8px; background: transparent; border: none; color: var(--color-accent); cursor: pointer; font-size: 12px; }
.comment-actions .btn-danger { color: var(--color-error); }
.comment-content { font-size: 13px; line-height: 1.5; white-space: pre-wrap; }
.comment-time { font-size: 11px; color: var(--color-secondary); margin-top: 4px; }
.edit-comment-form { margin-top: var(--space-sm); }
.edit-comment-form .editor-wrapper { border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; margin-bottom: var(--space-sm); }
.edit-comment-form .editor-wrapper :deep(.ql-toolbar) { border: none; border-bottom: 1px solid var(--color-border); background: var(--color-background); }
.edit-comment-form .editor-wrapper :deep(.ql-container) { border: none; font-size: 13px; }
.edit-comment-form .editor-wrapper :deep(.ql-editor) { min-height: 60px; padding: 8px 12px; }
.edit-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); }
.edit-actions button { padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; }
.edit-actions button:first-child { background: transparent; border: 1px solid var(--color-border); }
.edit-actions .btn-primary { background: var(--color-accent); color: white; border: none; }
.empty-comments { font-size: 13px; color: var(--color-secondary); text-align: center; padding: var(--space-md); }
.comment-input { display: flex; flex-direction: column; gap: var(--space-sm); }
.comment-input button { align-self: flex-end; padding: 8px 16px; background: var(--color-accent); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; }
.comment-input .editor-wrapper { border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
.comment-input .editor-wrapper :deep(.ql-toolbar) { border: none; border-bottom: 1px solid var(--color-border); background: var(--color-background); }
.comment-input .editor-wrapper :deep(.ql-container) { border: none; font-size: 13px; }
.comment-input .editor-wrapper :deep(.ql-editor) { min-height: 80px; padding: 8px 12px; }

.empty-state { text-align: center; padding: var(--space-2xl); color: var(--color-secondary); }
.empty-tasks { text-align: center; padding: var(--space-md); color: var(--color-secondary); font-size: 13px; }
.loading { text-align: center; padding: var(--space-2xl); }

.status-active { color: var(--color-success); }
.status-completed { color: var(--color-accent); }
.status-archived { color: var(--color-secondary); }
.status-pending { color: var(--color-secondary); }
.status-in_progress { color: var(--color-warning); }
.status-overdue { color: var(--color-error); }

.modal { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-content { width: 100%; max-width: 500px; padding: var(--space-xl); border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.5); background: var(--color-background); }
.modal-content h2 { font-size: 20px; font-weight: 600; margin-bottom: var(--space-lg); }
.form-group { margin-bottom: var(--space-md); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-xs); color: var(--color-secondary); }
.form-group input, .form-group textarea, .form-group select { width: 100%; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 8px; font-size: 14px; outline: none; }
.form-group textarea { min-height: 80px; resize: vertical; }
.editor-wrapper { border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
.editor-wrapper :deep(.ql-toolbar) { border: none; border-bottom: 1px solid var(--color-border); background: var(--color-surface); }
.editor-wrapper :deep(.ql-container) { border: none; font-size: 14px; }
.editor-wrapper :deep(.ql-editor) { min-height: 100px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }
.form-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-lg); }
.form-actions button { padding: 10px 20px; border-radius: 8px; font-size: 14px; cursor: pointer; }
.form-actions button:first-child { background: transparent; border: 1px solid var(--color-border); }
.form-actions button:last-child { background: var(--color-accent); color: white; border: none; }
</style>
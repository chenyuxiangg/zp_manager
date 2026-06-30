<template>
  <div class="layout">
    <main class="main-content">
      <div class="plans-page">
        <div class="page-header">
          <h1>学习计划</h1>
          <div class="header-actions">
            <BaseButton variant="secondary" @click="openTemplatesModal">从模板创建</BaseButton>
            <BaseButton variant="secondary" @click="openImportModal">导入计划</BaseButton>
            <BaseButton variant="primary" data-guide="create-plan" @click="showCreate = true">新建计划</BaseButton>
          </div>
        </div>

        <!-- 搜索和筛选工具栏 -->
        <div class="toolbar">
          <div class="search-box">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="搜索计划名称..."
              class="search-input"
            />
          </div>
          <div class="filter-box">
            <select v-model="statusFilter" class="filter-select">
              <option value="">全部状态</option>
              <option value="active">进行中</option>
              <option value="completed">已完成</option>
              <option value="archived">已归档</option>
            </select>
          </div>
        </div>

        <!-- Loading skeleton -->
        <SkeletonPlanCard v-if="plansStore.loading" />
        <!-- Plans list -->
        <div v-else-if="filteredPlans.length" class="plans-list">
          <div v-for="plan in filteredPlans" :key="plan.id" class="plan-card glass" @click="router.push('/plans/' + plan.id)">
            <h3>{{ plan.title }}</h3>
            <p>{{ plan.description }}</p>
            <div class="plan-meta">
              <span>{{ plan.start_date }} ~ {{ plan.end_date }}</span>
              <span :class="'status-' + plan.status">{{ getStatusLabel(plan.status) }}</span>
            </div>
          </div>
        </div>
        <EmptyState
          v-else-if="!searchQuery && !statusFilter"
          icon="📋"
          title="暂无学习计划"
          description="创建一个新计划开始管理你的任务"
          action-text="创建计划"
          @action="showCreate = true"
        />
        <EmptyState
          v-else
          icon="🔍"
          title="未找到匹配的计划"
          description="尝试调整搜索条件或筛选器"
          action-text="清除搜索"
          @action="clearSearch"
        />
      </div>
    </main>

    <!-- Create Plan Modal -->
    <div v-if="showCreate" class="modal" @click.self="closeCreateModal">
      <div class="modal-content glass">
        <h2>新建计划</h2>
        <form @submit.prevent="handleCreatePlan">
          <div class="form-group">
            <label>计划名称</label>
            <input
              v-model="newPlan.title"
              type="text"
              placeholder="请输入计划名称"
              :class="{ error: getError('title') }"
              @blur="setTouched('title')"
            />
            <div v-if="getError('title')" class="field-error">{{ getError('title') }}</div>
          </div>
          <div class="form-group">
            <label>描述</label>
            <textarea v-model="newPlan.description" placeholder="请输入计划描述"></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>开始日期</label>
              <input v-model="newPlan.start_date" type="date" required />
            </div>
            <div class="form-group">
              <label>结束日期</label>
              <input v-model="newPlan.end_date" type="date" required />
            </div>
          </div>
          <div class="form-actions">
            <BaseButton variant="secondary" type="button" @click="closeCreateModal">取消</BaseButton>
            <BaseButton variant="primary" type="submit">创建</BaseButton>
          </div>
        </form>
      </div>
    </div>

    <!-- Templates Modal -->
    <div v-if="showTemplates" class="modal" @click.self="showTemplates = false">
      <div class="modal-content glass">
        <h2>从模板创建</h2>
        <div v-if="templatesLoading" class="loading">加载中...</div>
        <div v-else-if="templates.length" class="templates-list">
          <div v-for="t in templates" :key="t.id" class="template-item" :class="{ selected: selectedTemplate?.id === t.id }" @click="selectTemplate(t)">
            <div class="template-info">
              <h4>{{ t.title }}</h4>
              <p>{{ t.description }}</p>
            </div>
            <button v-if="t.user_id !== 0" class="delete-template" @click.stop="deleteTemplate(t)" title="删除模板">×</button>
          </div>
        </div>
        <div v-else class="empty-state">暂无可用模板</div>
        <div v-if="selectedTemplate" class="template-form">
          <div class="form-group">
            <label>开始日期</label>
            <input v-model="templateStartDate" type="date" required />
          </div>
          <div class="form-actions">
            <button type="button" @click="cancelTemplate">取消</button>
            <button type="button" @click="handleCreateFromTemplate">确认创建</button>
          </div>
        </div>
        <div v-else class="form-actions" style="margin-top: 16px;">
          <button type="button" @click="showTemplates = false">关闭</button>
        </div>
      </div>
    </div>

    <!-- Import Modal -->
    <div v-if="showImport" class="modal" @click.self="closeImportModal">
      <div class="modal-content glass">
        <h2>导入学习计划</h2>
        <p class="import-hint">请上传JSON格式的学习计划文件，将直接创建计划</p>
        <div class="upload-area" @click="triggerFileInput" @dragover.prevent="isDragging = true" @dragleave="isDragging = false" @drop.prevent="handleFileDrop" :class="{ 'drag-over': isDragging }">
          <input ref="fileInput" type="file" accept=".json" @change="handleFileSelect" style="display: none;" />
          <div v-if="!selectedFile" class="upload-placeholder">
            <span class="upload-icon">📁</span>
            <span>点击或拖拽文件到此处</span>
          </div>
          <div v-else class="selected-file">
            <span class="file-icon">📄</span>
            <span>{{ selectedFile.name }}</span>
            <button class="remove-file" @click.stop="removeFile">×</button>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" @click="closeImportModal">取消</button>
          <button type="button" @click="handleImportPlan" :disabled="!selectedFile || importing">
            {{ importing ? '导入中...' : '确认导入' }}
          </button>
        </div>
      </div>
    </div>

    <!-- B0280/B0308: 模板删除 ConfirmDialog -->
    <ConfirmDialog
      :visible="showDeleteTemplateConfirm"
      title="确认删除模板"
      :message="deleteTemplatePrompt"
      :is-danger="true"
      :loading="deleteTemplateLoading"
      confirm-text="删除"
      @confirm="confirmDeleteTemplate"
      @cancel="cancelDeleteTemplate"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePlansStore } from '@/stores/plans'
import { useToast } from '@/composables/useToast'
import { useFormValidation, required, maxLength } from '@/composables/useFormValidation'
import SkeletonPlanCard from '@/components/common/SkeletonPlanCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
// B0254: 用基元组件替代原始 button
import BaseButton from '@/components/base/BaseButton.vue'

const router = useRouter()
const authStore = useAuthStore()
const plansStore = usePlansStore()
const toast = useToast()

const showCreate = ref(false)
const newPlan = ref({ title: '', description: '', start_date: '', end_date: '' })
const showTemplates = ref(false)
const templates = ref([])
const templatesLoading = ref(false)
const selectedTemplate = ref(null)
const templateStartDate = ref('')
const showImport = ref(false)
const selectedFile = ref(null)
const fileInput = ref(null)
const isDragging = ref(false)
const importing = ref(false)
// B0280/B0308: 删除模板的 ConfirmDialog 状态
const showDeleteTemplateConfirm = ref(false)
const pendingDeleteTemplate = ref(null)
const deleteTemplateLoading = ref(false)
const deleteTemplatePrompt = computed(() =>
  pendingDeleteTemplate.value
    ? `确定要删除模板"${pendingDeleteTemplate.value.title}"吗？`
    : ''
)

// 搜索和筛选
const searchQuery = ref('')
const statusFilter = ref('')

// 筛选后的计划列表
const filteredPlans = computed(() => {
  let plans = plansStore.plans

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    plans = plans.filter(plan =>
      plan.title.toLowerCase().includes(query) ||
      (plan.description && plan.description.toLowerCase().includes(query))
    )
  }

  // 状态筛选
  if (statusFilter.value) {
    plans = plans.filter(plan => plan.status === statusFilter.value)
  }

  return plans
})

// 状态标签映射
const statusLabels = {
  active: '进行中',
  completed: '已完成',
  archived: '已归档'
}

function getStatusLabel(status) {
  return statusLabels[status] || status
}

// 清空搜索
function clearSearch() {
  searchQuery.value = ''
  statusFilter.value = ''
}

// 表单验证
const { validateAll, clearErrors, setTouched, getError } = useFormValidation(
  { title: '', description: '', start_date: '', end_date: '' },
  {
    title: [required('请输入计划名称'), maxLength(50, '名称最多50字符')]
  }
)

onMounted(async () => {
  await loadPlans()
})

async function loadPlans() {
  await plansStore.fetchPlans()
}

function closeCreateModal() {
  showCreate.value = false
  clearErrors()
  newPlan.value = { title: '', description: '', start_date: '', end_date: '' }
}

async function handleCreatePlan() {
  clearErrors()
  if (!validateAll(newPlan.value)) {
    return
  }

  try {
    const res = await plansStore.createPlan(newPlan.value)
    if (res.success) {
      toast.success('计划创建成功')
      closeCreateModal()
    } else {
      toast.error(res.error?.message || '创建失败')
    }
  } catch (e) {
    toast.error(e?.response?.data?.error?.message || '创建失败')
  }
}

async function loadTemplates() {
  templatesLoading.value = true
  const res = await plansStore.fetchTemplates()
  templatesLoading.value = false
  if (res.success) templates.value = res.data.templates
}

function selectTemplate(t) {
  selectedTemplate.value = t
  templateStartDate.value = ''
}

function cancelTemplate() {
  selectedTemplate.value = null
  templateStartDate.value = ''
}

async function deleteTemplate(t) {
  pendingDeleteTemplate.value = t
  showDeleteTemplateConfirm.value = true
}
function cancelDeleteTemplate() {
  showDeleteTemplateConfirm.value = false
  pendingDeleteTemplate.value = null
  deleteTemplateLoading.value = false
}
async function confirmDeleteTemplate() {
  const t = pendingDeleteTemplate.value
  if (!t) return
  deleteTemplateLoading.value = true
  try {
    const res = await plansStore.deleteTemplate(t.id)
    if (res.success) {
      toast.success('模板已删除')
      await loadTemplates()
    } else {
      toast.error(res.error?.message || '删除失败')
    }
  } catch (e) {
    toast.error(e?.response?.data?.error?.message || '删除失败')
  } finally {
    deleteTemplateLoading.value = false
    cancelDeleteTemplate()
  }
}

async function handleCreateFromTemplate() {
  if (!templateStartDate.value) {
    toast.error('请选择开始日期')
    return
  }
  try {
    const res = await plansStore.createPlanFromTemplate(
      selectedTemplate.value.id,
      templateStartDate.value
    )
    if (res && res.success) {
      toast.success('计划创建成功')
      showTemplates.value = false
      selectedTemplate.value = null
      await loadPlans()
    } else {
      toast.error(res?.error?.message || '创建失败')
    }
  } catch (e) {
    toast.error(e?.response?.data?.error?.message || '创建失败')
  }
}

function openTemplatesModal() {
  showTemplates.value = true
  loadTemplates()
}

function openImportModal() {
  showImport.value = true
  selectedFile.value = null
}

function closeImportModal() {
  showImport.value = false
  selectedFile.value = null
}

function triggerFileInput() {
  fileInput.value.click()
}

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (file) {
    selectedFile.value = file
  }
}

function handleFileDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer.files[0]
  if (file && file.name.endsWith('.json')) {
    selectedFile.value = file
  } else {
    toast.error('请上传JSON格式的文件')
  }
}

function removeFile() {
  selectedFile.value = null
  if (fileInput.value) {
    fileInput.value.value = ''
  }
}

async function handleImportPlan() {
  if (!selectedFile.value) return

  importing.value = true
  const formData = new FormData()
  formData.append('file', selectedFile.value)

  try {
    const res = await plansStore.importTemplate(formData)
    if (res.success) {
      toast.success('导入成功')
      closeImportModal()
      await loadPlans()
    } else {
      toast.error(res.error?.message || '导入失败')
    }
  } catch (e) {
    toast.error(e?.response?.data?.error?.message || '导入失败')
  } finally {
    importing.value = false
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
nav a { color: var(--color-secondary); text-decoration: none; font-size: 14px; transition: color 0.2s; }
nav a:hover, nav a.router-link-active { color: var(--color-primary); }
.user-info { display: flex; align-items: center; gap: var(--space-md); font-size: 14px; }
.points { color: var(--color-accent); font-weight: 600; }
.user-info button { padding: 6px 12px; border: 1px solid var(--color-border); background: transparent; border-radius: 6px; cursor: pointer; font-size: 13px; }
.main-content { max-width: 1200px; margin: 0 auto; padding: var(--space-xl) var(--space-lg); }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-lg); }
.page-header h1 { font-size: 24px; font-weight: 600; }
.page-header button { padding: 10px 20px; background: var(--color-accent); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; transition: opacity 0.2s; }
.page-header button:hover { opacity: 0.9; }
.header-actions { display: flex; gap: var(--space-sm); }
.header-actions button:first-child { background: transparent; border: 1px solid var(--color-accent); color: var(--color-accent); }
.header-actions button:nth-child(2) { background: transparent; border: 1px solid var(--color-accent); color: var(--color-accent); }

/* 搜索工具栏 */
.toolbar {
  display: flex;
  gap: var(--space-md);
  margin-bottom: var(--space-lg);
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 200px;
  max-width: 400px;
}

.search-input {
  width: 100%;
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-alpha);
}

.search-input::placeholder {
  color: var(--color-secondary);
}

.filter-box {
  min-width: 140px;
}

.filter-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s;
}

.filter-select:focus {
  border-color: var(--color-accent);
}

.plans-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--space-md); }
.plan-card { padding: var(--space-lg); border-radius: 12px; border: 1px solid var(--color-card-border); cursor: pointer; transition: all 0.2s; }
.plan-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px var(--shadow-color-medium); border-color: var(--color-accent); }
.plan-card h3 { font-size: 16px; font-weight: 600; margin-bottom: var(--space-sm); }
.plan-card p { font-size: 13px; color: var(--color-secondary); margin-bottom: var(--space-sm); }
.plan-meta { display: flex; justify-content: space-between; font-size: 12px; color: var(--color-secondary); }
.status-active { color: var(--color-success); }
.status-completed { color: var(--color-accent); }
.status-archived { color: var(--color-secondary); }
.empty-state { text-align: center; padding: var(--space-2xl); color: var(--color-secondary); }
.templates-list { max-height: 300px; overflow-y: auto; margin-bottom: var(--space-md); }
.template-item { padding: var(--space-md); border: 1px solid var(--color-border); border-radius: 8px; margin-bottom: var(--space-sm); cursor: pointer; transition: background 0.2s; display: flex; align-items: center; justify-content: space-between; }
.template-item:hover { background: var(--color-overlay-soft); }
.template-item.selected { background: var(--color-accent-tint); border-color: var(--color-accent); }
.template-info { flex: 1; }
.delete-template { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--color-secondary); padding: 4px 8px; }
.delete-template:hover { color: var(--color-error); }
.template-item h4 { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
.template-item p { font-size: 12px; color: var(--color-secondary); margin: 0; }
.template-form { border-top: 1px solid var(--color-border); padding-top: var(--space-md); }
.loading { text-align: center; padding: var(--space-lg); color: var(--color-secondary); }
.import-hint { font-size: 13px; color: var(--color-secondary); margin-bottom: var(--space-md); }
.upload-area { border: 2px dashed var(--color-border); border-radius: 12px; padding: var(--space-xl); text-align: center; cursor: pointer; transition: border-color 0.2s, background 0.2s; margin-bottom: var(--space-md); }
.upload-area:hover, .upload-area.drag-over { border-color: var(--color-accent); background: var(--color-accent-tint-soft); }
.upload-placeholder { display: flex; flex-direction: column; align-items: center; gap: var(--space-sm); color: var(--color-secondary); }
.upload-icon { font-size: 32px; }
.selected-file { display: flex; align-items: center; justify-content: center; gap: var(--space-sm); color: var(--color-primary); }
.file-icon { font-size: 24px; }
.remove-file { background: none; border: none; font-size: 20px; cursor: pointer; color: var(--color-secondary); padding: 0 4px; }
.remove-file:hover { color: var(--color-error); }
.modal { position: fixed; inset: 0; background: var(--color-overlay); display: flex; align-items: center; justify-content: center; z-index: 100; animation: fade-in 0.2s ease; }
.modal-content { width: 100%; max-width: 500px; padding: var(--space-xl); border-radius: 16px; border: 1px solid var(--color-card-border); animation: scale-in 0.2s ease; }
.modal-content h2 { font-size: 20px; font-weight: 600; margin-bottom: var(--space-lg); }
.form-group { margin-bottom: var(--space-md); }
.form-group label { display: block; font-size: 13px; font-weight: 500; margin-bottom: var(--space-xs); color: var(--color-secondary); }
.form-group input, .form-group textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--color-border); border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s, box-shadow 0.2s; }
.form-group input:focus, .form-group textarea:focus { border-color: var(--color-accent); box-shadow: 0 0 0 3px var(--color-accent-alpha); }
.form-group input.error { border-color: var(--color-error); }
.form-group textarea { min-height: 80px; resize: vertical; }
.field-error { color: var(--color-error); font-size: 12px; margin-top: 4px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }
.form-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-lg); }
.form-actions button { padding: 10px 20px; border-radius: 8px; font-size: 14px; cursor: pointer; transition: opacity 0.2s; }
.form-actions button:first-child { background: transparent; border: 1px solid var(--color-border); }
.form-actions button:last-child { background: var(--color-accent); color: white; border: none; }
.form-actions button:hover { opacity: 0.9; }
.form-actions button:disabled { opacity: 0.6; cursor: not-allowed; }

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
  }
  .search-box, .filter-box {
    max-width: 100%;
    width: 100%;
  }
}
</style>
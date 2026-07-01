<template>
  <div class="layout">
    <main class="main-content">
      <div class="dashboard">
        <div class="stats-grid">
          <!-- B0302 Q3: 4 个 stat-card → BaseCard -->
          <BaseCard elevation="raised" padding="md" class="stat-card" data-guide="welcome">
            <div class="stat-label">我的积分</div>
            <div class="stat-value">{{ authStore.user?.points || 0 }}</div>
          </BaseCard>
          <BaseCard elevation="raised" padding="md" class="stat-card">
            <div class="stat-label">总任务</div>
            <div class="stat-value">{{ profile?.stats?.total_tasks || 0 }}</div>
          </BaseCard>
          <BaseCard elevation="raised" padding="md" class="stat-card">
            <div class="stat-label">已完成</div>
            <div class="stat-value">{{ profile?.stats?.completed_tasks || 0 }}</div>
          </BaseCard>
          <BaseCard elevation="raised" padding="md" class="stat-card">
            <div class="stat-label">超期任务</div>
            <div class="stat-value overdue">{{ profile?.stats?.overdue_tasks || 0 }}</div>
          </BaseCard>
        </div>
        <!-- v2.18: AN0009+AN0011 — Streak + ProgressRing 接入 -->
        <div class="streak-row">
          <StreakCard
            :current="streakStore.current"
            :longest="streakStore.longest"
            :next-milestone="streakStore.nextMilestone"
            :days-to-next="streakStore.daysToNextMilestone"
          />
          <BaseCard elevation="raised" padding="md" class="progress-card">
            <div class="stat-label">任务完成率</div>
            <ProgressRing
              :value="completionRate"
              :max="100"
              :label="`${completionRate}%`"
              :thickness="6"
              direction="progress"
            />
          </BaseCard>
        </div>
        <!-- v6: B0328-fix — 7/30/100 天里程碑全貌展示 -->
        <div class="milestone-row">
          <StreakMilestoneCard
            :current="streakStore.current"
            :days-to-7="streakStore.daysTo7"
            :days-to-30="streakStore.daysTo30"
            :days-to-100="streakStore.daysTo100"
          />
        </div>
        <!-- B0351: 引导 step 3 (task-toggle) 锚点：选 h2 而非具体按钮，
             避免「今日暂无任务」状态时按钮不在 DOM → dummy anchor fallback。
             h2 永远在 DOM（section 始终存在），popover 描述直接告诉用户
             「完成右侧的『完成』按钮即拿积分」即可 -->
        <div class="section" data-guide="task-toggle-section">
          <h2 data-guide="task-toggle">今日任务</h2>
          <div v-if="loading" class="skeleton-list">
            <div v-for="i in 3" :key="i" class="skeleton-task"></div>
          </div>
          <div v-else-if="todayTasks.length" class="task-list">
            <div v-for="task in todayTasks" :key="task.id" class="task-item glass">
              <div class="task-content">
                <div class="task-title">{{ task.title }}</div>
                <div v-if="task.description" class="task-desc" v-html="sanitizeHtml(task.description)"></div>
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
          <div v-else-if="summaryByDate.length" class="overdue-stack">
            <button
              v-for="(scheduledDate, idx) in visibleOrder"
              :key="scheduledDate"
              type="button"
              class="overdue-card"
              :class="[
                `overdue-card--${getGroup(scheduledDate)?.severity || 'warning'}`,
                idx === 0 ? 'overdue-card--top' : '',
                dragging === scheduledDate ? 'is-dragging' : ''
              ]"
              :style="{
                '--stack-index': idx,
                '--drag-x': dragging === scheduledDate ? dragPos.x + 'px' : '0px',
                '--drag-y': dragging === scheduledDate ? dragPos.y + 'px' : '0px'
              }"
              :aria-label="`查看 ${scheduledDate} 的 ${getGroup(scheduledDate)?.taskCount || 0} 个超期任务`"
              @mousedown="handleCardMouseDown($event, scheduledDate)"
            >
              <div class="overdue-card__head">
                <div class="overdue-card__date-block">
                  <div class="overdue-card__date">{{ formatDateShort(scheduledDate) }}</div>
                  <div class="overdue-card__relative">{{ formatRelative(scheduledDate) }}</div>
                </div>
                <div class="overdue-card__chip">{{ getGroup(scheduledDate)?.daysOverdue ?? 0 }} 天前</div>
              </div>
              <div class="overdue-card__body">
                <div class="overdue-card__stat">
                  <div class="overdue-card__stat-value">{{ getGroup(scheduledDate)?.taskCount ?? 0 }}</div>
                  <div class="overdue-card__stat-label">个任务</div>
                </div>
                <div class="overdue-card__stat">
                  <div class="overdue-card__stat-value">{{ getGroup(scheduledDate)?.totalPoints ?? 0 }}</div>
                  <div class="overdue-card__stat-label">积分待补</div>
                </div>
                <div class="overdue-card__ring">
                  <ProgressRing
                    :value="getGroup(scheduledDate)?.completionRate ?? 0"
                    :max="100"
                    :thickness="3"
                    :label="`${getGroup(scheduledDate)?.completionRate ?? 0}%`"
                    direction="progress"
                  />
                </div>
              </div>
              <div class="overdue-card__cta">查看详情 →</div>
            </button>
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
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
// v2.18: AN0009 — Streak 接入 Dashboard
import { useStreakStore } from '@/stores/streak'
import { useToast } from '@/composables/useToast'
import EmptyState from '@/components/common/EmptyState.vue'
// B0302 Q3: 4 个 stat-card → BaseCard
import BaseCard from '@/components/base/BaseCard.vue'
// v2.18: AN0009 — StreakCard 视图组件
import StreakCard from '@/components/streak/StreakCard.vue'
// v6: B0328-fix — StreakMilestoneCard 视图组件（7/30/100 里程碑全貌）
import StreakMilestoneCard from '@/components/streak/StreakMilestoneCard.vue'
// v2.18: AN0011 — ProgressRing 视图组件
import ProgressRing from '@/components/common/ProgressRing.vue'
// B0292: XSS 防御 — sanitizeHtml 用于 v-html 前置过滤
import { sanitizeHtml } from '@/utils/sanitize'
// PR0026: 超期任务按日期分组
import { groupOverdueByDate } from '@/utils/groupOverdueByDate'
// PR0026: 拖动最上层卡片到牌堆底时重排 order 数组
import { reorderStackAfterDrag } from '@/utils/reorderStack'
// PR0026 v2.1: 最多只展示前 5 张卡片，超出时只有拖动最顶层才顺序露出
import { limitVisibleOrder } from '@/utils/limitVisibleOrder'
import { formatDate, formatRelative } from '@/plugins/dayjs'

const router = useRouter()
const authStore = useAuthStore()
const tasksStore = useTasksStore()
const streakStore = useStreakStore()
const toast = useToast()
const profile = ref(null)
const todayTasks = ref([])
const overdueTasks = ref([])
const loading = ref(false)
// v2.18: AN0011 — 任务完成率 (completed / total)
const completionRate = computed(() => {
  const total = profile.value?.stats?.total_tasks || 0
  const completed = profile.value?.stats?.completed_tasks || 0
  if (total <= 0) return 0
  return Math.round((completed / total) * 100)
})
// PR0026: 超期任务按 scheduled_date 分组，按严重度配色
const summaryByDate = computed(() => groupOverdueByDate(overdueTasks.value))

// PR0026: 拖拽重排 — order 数组决定每张卡片在牌堆中的位置（idx 0 = 最上层 / 可拖动）
// summaryByDate 变化时同步 order，新增日期追加到末尾，已存在项保持原位（拖动结果不丢）
const order = ref([])
watch(summaryByDate, (groups) => {
  const dates = groups.map(g => g.scheduled_date)
  const existing = order.value.filter(d => dates.includes(d))
  const added = dates.filter(d => !existing.includes(d))
  order.value = [...existing, ...added]
}, { immediate: true })

// PR0026 v2.1: 最多展示 5 张卡片；超过 5 张时，超出部分只在拖动最顶层卡片后依次露出
const MAX_VISIBLE = 5
const visibleOrder = computed(() => limitVisibleOrder(order.value, MAX_VISIBLE))

function getGroup(scheduledDate) {
  return summaryByDate.value.find(g => g.scheduled_date === scheduledDate)
}

// PR0026: 卡片头部用简短日期（"MM-DD"）
function formatDateShort(date) {
  return formatDate(date, 'MM-DD')
}

// PR0026: 点击卡片 → 跳转到 Tasks.vue 的超期 tab + 该日期筛选
function goToOverdue(scheduledDate) {
  router.push({ path: '/tasks', query: { tab: 'overdue', date: scheduledDate } })
}

// PR0026: 鼠标拖动把最上层卡片放到牌堆底
// v2.2 bugfix: 修复"高概率附着在鼠标上无法释放"
const dragging = ref(null)        // 当前拖动的 scheduled_date
const dragMoved = ref(false)       // 是否真的发生了位移（区分 click vs drag）
const dragPos = ref({ x: 0, y: 0 }) // 鼠标相对 mousedown 位置的**纯位移**
const dragStart = ref({ x: 0, y: 0 }) // mousedown 时鼠标坐标（基线）

function handleCardMouseDown(event, scheduledDate) {
  if (event.button !== 0) return // 只响应左键
  event.preventDefault()

  // v2.2 防御性清理：避免上一次 mousedown 的 listener 没正确清理导致重复监听
  document.removeEventListener('mousemove', handleCardMouseMove)
  document.removeEventListener('mouseup', handleCardMouseUp)

  dragging.value = scheduledDate
  dragMoved.value = false
  dragStart.value = { x: event.clientX, y: event.clientY }
  dragPos.value = { x: 0, y: 0 }
  document.addEventListener('mousemove', handleCardMouseMove)
  document.addEventListener('mouseup', handleCardMouseUp)
}

function handleCardMouseMove(event) {
  if (!dragging.value) return
  if (!dragMoved.value) dragMoved.value = true
  // v2.2 bugfix: 之前误算成 clientX - stackRect.left - (clientX - rect.left)，
  // 等价于 clientX - clientDownX + idx*8，导致 transform 多加了 idx*8（CSS 已 +idx*8）。
  // 正确公式：dragPos.x = 鼠标相对 mousedown 的纯水平位移
  dragPos.value = {
    x: event.clientX - dragStart.value.x,
    y: event.clientY - dragStart.value.y
  }
}

function handleCardMouseUp() {
  const dragged = dragging.value
  const wasMoved = dragMoved.value
  if (dragged && wasMoved) {
    // 真正拖动 → 把该卡片放到 order 末尾
    order.value = reorderStackAfterDrag(order.value, dragged)
  } else if (dragged && !wasMoved) {
    // 没拖动 = 点击 → 跳转详情
    goToOverdue(dragged)
  }
  dragging.value = null
  dragMoved.value = false
  dragPos.value = { x: 0, y: 0 }
  document.removeEventListener('mousemove', handleCardMouseMove)
  document.removeEventListener('mouseup', handleCardMouseUp)
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', handleCardMouseMove)
  document.removeEventListener('mouseup', handleCardMouseUp)
})

onMounted(async () => {
  await authStore.fetchUser()
  await loadData()
  // v2.18: AN0009 — Streak 数据拉取（streak store 内置 5min cache）
  await streakStore.fetchStreak()
})

async function loadData() {
  loading.value = true
  const [profileRes, todayRes, overdueRes] = await Promise.all([
    authStore.fetchUserProfile(),
    tasksStore.fetchTodayTasks(),
    tasksStore.fetchOverdueTasks()
  ])
  if (profileRes.success) profile.value = profileRes.data
  if (todayRes.success) todayTasks.value = todayRes.data.tasks || []
  if (overdueRes.success) overdueTasks.value = overdueRes.data.tasks || []
  loading.value = false
}

async function completeTask(taskId) {
  try {
    const res = await tasksStore.completeTask(taskId)
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

// B0341: 删除死代码 handleLogout（改由 AppHeader/AppLayout/Settings 的 useLogout 入口触发）
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

/* v6: B0328-fix — 里程碑面板单列行 */
.milestone-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-md);
  margin-bottom: var(--space-xl);
}

.stat-card {
  padding: var(--space-lg);
  border-radius: 12px;
  border: 1px solid var(--color-card-border);
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px var(--shadow-color-soft);
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
  border: 1px solid var(--color-card-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  transition: all 0.2s;
}

.task-item:hover {
  box-shadow: 0 4px 12px var(--shadow-color-soft);
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
  background: linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-mid) 50%, var(--skeleton-end) 75%);
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
  /* v6: B0328-fix — 移动端 streak-row 也变单列 */
  .streak-row {
    grid-template-columns: 1fr;
  }
}

/* PR0026 v2.3 bugfix: 改用 grid 让所有卡片重叠在同一个 cell，
   容器高度自然等于单卡片高度（不再 absolute 溢出遮挡 h2 标题） */
/* PR0026 v2.1: 最多展示 5 张，超出时拖动最顶层才顺序露出 */
/* 所有可见卡片左下角 y 相同，x 向右平移 8px；最大偏移 4 * 8px = 32px */
.overdue-stack {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  position: relative;
  padding-right: 32px; /* 给最右卡片偏移留溢出空间 */
  user-select: none;
}

.overdue-card {
  /* 同一 grid cell：grid 容器高度 = 单卡片高度（多张卡片不累加） */
  grid-row: 1;
  grid-column: 1;
  position: relative; /* 让 z-index 生效 */
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: var(--color-background);
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-md);
  cursor: grab;
  font: inherit;
  color: inherit;
  text-align: left;
  /* 错位 + 拖动偏移：idx 决定 base 偏移，--drag-x/y 是鼠标拖动增量 */
  transform: translate(
    calc(var(--stack-index, 0) * 8px + var(--drag-x, 0px)),
    var(--drag-y, 0px)
  );
  /* z-index: idx 0 = 最上层 = 视觉最顶；idx 越大 z 越低，被前 5 张盖住 */
  z-index: calc(100 - var(--stack-index, 0));
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.2s ease,
              border-color 0.2s ease;
  box-shadow: 0 1px 4px var(--shadow-color-faint);
}

.overdue-card:hover {
  box-shadow: 0 3px 10px var(--shadow-color-soft);
}

.overdue-card:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

/* 顶层卡片（idx=0）加重 */
.overdue-card--top {
  border-width: 2px;
  padding: 7px 9px; /* 视觉保持一致 */
}

/* 严重度配色 */
.overdue-card--severe {
  border-left: 3px solid var(--color-error);
}
.overdue-card--warning {
  border-left: 3px solid var(--color-warning);
}

/* 拖动中：禁用 transition，置顶显示 */
.overdue-card.is-dragging {
  cursor: grabbing;
  transition: none;
  z-index: 9999;
  box-shadow: 0 12px 24px var(--shadow-color-strong);
}

.overdue-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-sm);
}

.overdue-card__date-block {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.overdue-card__date {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-primary);
}

.overdue-card__relative {
  font-size: 11px;
  color: var(--color-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overdue-card__chip {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 9999px;
  white-space: nowrap;
  flex-shrink: 0;
}
.overdue-card--severe .overdue-card__chip {
  background: var(--color-error-alpha);
  color: var(--color-error);
}
.overdue-card--warning .overdue-card__chip {
  background: var(--color-warning-alpha);
  color: var(--color-warning);
}

.overdue-card__body {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.overdue-card__stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.overdue-card__stat-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--color-primary);
}

.overdue-card__stat-label {
  font-size: 11px;
  color: var(--color-secondary);
}

.overdue-card__ring {
  margin-left: auto;
  /* 缩小完成环尺寸以适配紧凑卡片 */
}

.overdue-card__cta {
  display: none; /* 紧凑卡片隐藏底部 CTA，鼠标 hover 时再显示 */
}

.overdue-card:hover .overdue-card__cta {
  display: block;
  font-size: 11px;
  color: var(--color-accent);
  font-weight: 500;
}

/* 移动端：减弱拖动错位感 */
@media (max-width: 768px) {
  .overdue-card {
    transform: translate(
      calc(var(--stack-index, 0) * 5px + var(--drag-x, 0px)),
      var(--drag-y, 0px)
    );
  }
  .overdue-stack {
    padding-right: 20px;
  }
  .overdue-card__cta {
    display: block; /* 移动端 hover 不可用，常驻显示 */
  }
}
</style>
<template>
  <div class="layout">
    <main class="main-content">
      <div class="reports-page">
        <h1>学习报表</h1>
        <div class="tabs">
          <button :class="{ active: tab === 'generate' }" @click="tab = 'generate'">生成报表</button>
          <button :class="{ active: tab === 'history' }" @click="switchToHistory">历史记录</button>
        </div>

        <!-- 生成报表 -->
        <div v-if="tab === 'generate'" class="tab-content">
          <div class="report-type-tabs">
            <button :class="{ active: reportType === 'weekly' }" @click="reportType = 'weekly'; loadReport()">周报</button>
            <button :class="{ active: reportType === 'monthly' }" @click="reportType = 'monthly'; loadReport()">月报</button>
            <button :class="{ active: reportType === 'yearly' }" @click="reportType = 'yearly'; loadReport()">年报</button>
          </div>
          <div v-if="report" class="report-content glass">
            <div class="report-header">
              <span>周期: {{ report.period }}</span>
              <span>{{ report.period_start }} ~ {{ report.period_end }}</span>
            </div>
            <!-- B0250: 同比/环比 + ECharts 趋势线 + 热力图 + 移动端降级表格 -->
            <div class="report-compare">
              <PeriodCompareCard title="完成任务" :current="report.completed || 0" :previous="report.prev_completed || 0" unit=" 个" />
              <PeriodCompareCard title="获得积分" :current="report.points_earned || 0" :previous="report.prev_points_earned || 0" unit=" 分" />
              <PeriodCompareCard title="评论数" :current="report.comments || 0" :previous="report.prev_comments || 0" unit=" 条" />
            </div>
            <TrendLineChart v-if="!mobile && report.trend_series" :series="report.trend_series" :height="280" />
            <!-- B0322: 年报时用 yearlyHeatmap（365 天全年）+ year prop；周/月报用 report.heatmap 兜底 -->
            <CompletionHeatmap
              v-if="!mobile && (yearlyHeatmap || report.heatmap)"
              :data="reportType === 'yearly' ? yearlyHeatmap : report.heatmap"
              :year="reportType === 'yearly' ? heatmapYear : null"
              :height="200"
            />
            <MobileFallbackTable
              v-if="mobile && report.table"
              :title="`${report.period} 完成明细`"
              :columns="report.table.columns"
              :rows="report.table.rows"
            />
            <div class="stats-row">
              <div class="stat">
                <div class="stat-value">{{ report.summary.total_tasks }}</div>
                <div class="stat-label">总任务</div>
              </div>
              <div class="stat">
                <div class="stat-value">{{ report.summary.completed_tasks }}</div>
                <div class="stat-label">已完成</div>
              </div>
              <div class="stat">
                <div class="stat-value">{{ report.summary.completion_rate }}</div>
                <div class="stat-label">完成率</div>
              </div>
              <div class="stat">
                <div class="stat-value positive">+{{ report.summary.points_earned }}</div>
                <div class="stat-label">获得积分</div>
              </div>
              <div class="stat">
                <div class="stat-value negative">-{{ report.summary.points_spent }}</div>
                <div class="stat-label">扣除积分</div>
              </div>
            </div>
          </div>
          <div v-else class="empty-state">点击上方按钮生成报表</div>
        </div>

        <!-- 历史记录 -->
        <div v-if="tab === 'history'" class="tab-content">
          <div class="history-type-tabs">
            <button :class="{ active: historyType === 'weekly' }" @click="historyType = 'weekly'; loadHistory()">周报</button>
            <button :class="{ active: historyType === 'monthly' }" @click="historyType = 'monthly'; loadHistory()">月报</button>
            <button :class="{ active: historyType === 'yearly' }" @click="historyType = 'yearly'; loadHistory()">年报</button>
          </div>
          <div v-if="history.length" class="history-list">
            <div v-for="r in history" :key="r.id" class="history-item glass">
              <div class="history-info">
                <span class="history-period">{{ r.period_start }} ~ {{ r.period_end }}</span>
                <span class="history-type">{{ r.type }}</span>
              </div>
              <div class="history-stats">
                <span>完成 {{ r.summary?.completed_tasks || 0 }} / {{ r.summary?.total_tasks || 0 }} 任务</span>
                <span class="completion-rate">完成率 {{ r.summary?.completion_rate || 0 }}</span>
              </div>
              <div class="history-time">{{ r.created_at }}</div>
            </div>
          </div>
          <div v-else class="empty-state">暂无历史报表</div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useReportsStore } from '@/stores/reports'
// B0250: 集成 4 个报表组件
import TrendLineChart from '@/components/reports/TrendLineChart.vue'
import CompletionHeatmap from '@/components/reports/CompletionHeatmap.vue'
import PeriodCompareCard from '@/components/reports/PeriodCompareCard.vue'
import MobileFallbackTable from '@/components/reports/MobileFallbackTable.vue'
import { isMobile } from '@/composables/useECharts'

const router = useRouter()
const authStore = useAuthStore()
const reportsStore = useReportsStore()
const tab = ref('generate')
const reportType = ref('weekly')
const report = ref(null)
const mobile = ref(isMobile())

// B0322: 年报时并发拉 yearly-heatmap（365 天热力图），周/月报时清空
const yearlyHeatmap = ref(null)
const heatmapYear = ref(new Date().getFullYear())

onMounted(() => {
  window.addEventListener('resize', () => { mobile.value = isMobile() })
})
const historyType = ref('weekly')
const history = ref([])

async function loadReport() {
  const res = await reportsStore.fetchReport(reportType.value)
  if (res.success) {
    report.value = res.data.report
    // B0322: 年报时额外并发拉 yearlyHeatmap（独立端点，PR0007 设计契约）
    if (reportType.value === 'yearly') {
      const hmRes = await reportsStore.fetchYearlyHeatmap(heatmapYear.value)
      if (hmRes.success) yearlyHeatmap.value = hmRes.data.days
    } else {
      yearlyHeatmap.value = null
    }
  }
}

async function switchToHistory() {
  tab.value = 'history'
  if (!history.value.length) {
    await loadHistory()
  }
}

async function loadHistory() {
  const res = await reportsStore.fetchHistory(historyType.value)
  if (res.success) {
    history.value = res.data.reports || []
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
.reports-page h1 { font-size: 24px; font-weight: 600; margin-bottom: var(--space-lg); }
.tabs { display: flex; gap: var(--space-sm); margin-bottom: var(--space-lg); }
.tabs button { padding: 8px 16px; border: 1px solid var(--color-border); background: white; border-radius: 8px; cursor: pointer; font-size: 14px; }
.tabs button.active { background: var(--color-accent); color: white; border-color: var(--color-accent); }
.report-content { padding: var(--space-lg); border-radius: 12px; border: 1px solid var(--color-card-border); }
.report-header { display: flex; justify-content: space-between; font-size: 14px; color: var(--color-secondary); margin-bottom: var(--space-lg); }
.stats-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-md); }
.stat { text-align: center; }
.stat-value { font-size: 28px; font-weight: 700; }
.stat-value.positive { color: var(--color-success); }
.stat-value.negative { color: var(--color-error); }
.stat-label { font-size: 13px; color: var(--color-secondary); margin-top: 4px; }
.empty-state { text-align: center; padding: var(--space-xl); color: var(--color-secondary); }
.tab-content { margin-top: var(--space-md); }
.report-type-tabs, .history-type-tabs { display: flex; gap: var(--space-sm); margin-bottom: var(--space-lg); }
.report-type-tabs button, .history-type-tabs button { padding: 6px 12px; border: 1px solid var(--color-border); background: white; border-radius: 6px; cursor: pointer; font-size: 13px; }
.report-type-tabs button.active, .history-type-tabs button.active { background: var(--color-accent); color: white; border-color: var(--color-accent); }
.history-list { display: flex; flex-direction: column; gap: var(--space-sm); }
.history-item { padding: var(--space-md); border-radius: 10px; border: 1px solid var(--color-card-border); display: flex; justify-content: space-between; align-items: center; }
.history-info { display: flex; flex-direction: column; gap: 4px; }
.history-period { font-size: 14px; font-weight: 500; }
.history-type { font-size: 12px; color: var(--color-accent); }
.history-stats { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: var(--color-secondary); }
.completion-rate { color: var(--color-success); }
.history-time { font-size: 12px; color: var(--color-secondary); }
</style>
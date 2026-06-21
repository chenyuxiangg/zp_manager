<template>
  <div class="pomodoro-history">
    <h3 class="pomodoro-history__title">专注记录</h3>
    <ul v-if="sessions.length > 0" class="pomodoro-history__list">
      <li v-for="s in sessions" :key="s.id" class="pomodoro-history__item">
        <span class="pomodoro-history__date">{{ formatDate(s.started_at) }}</span>
        <!-- B0314: 字段名修复 — 用 actual_seconds（实际秒数）+ planned_minutes（计划分钟数） -->
        <span class="pomodoro-history__duration">{{ formatDuration(s.actual_seconds, s.planned_minutes) }}</span>
        <span v-if="s.completed" class="pomodoro-history__badge pomodoro-history__badge--done">完成</span>
        <span v-else class="pomodoro-history__badge pomodoro-history__badge--abandon">放弃</span>
      </li>
    </ul>
    <p v-else class="pomodoro-history__empty">暂无专注记录</p>
  </div>
</template>

<script setup>
defineProps({
  sessions: { type: Array, default: () => [] },
})

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

// B0314: 字段名修复 — 用 actual_seconds（实际秒数）+ planned_minutes（计划分钟数）
// 策略：双字段兜底 — 优先实际秒数（已完成），其次计划分钟数（未完成），最后 '—'
function formatDuration(actualSeconds, plannedMinutes) {
  if (actualSeconds != null && actualSeconds > 0) {
    const m = Math.round(actualSeconds / 60)
    return `${m} 分钟`
  }
  if (plannedMinutes != null) {
    return `${plannedMinutes} 分钟（计划）`
  }
  return '—'
}
</script>

<style scoped>
.pomodoro-history {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.pomodoro-history__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.pomodoro-history__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.pomodoro-history__item {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-surface, #f5f5f7);
  border-radius: var(--radius-sm);
  font-size: 13px;
}

.pomodoro-history__date { color: var(--text-secondary); flex: 1; }
.pomodoro-history__duration { color: var(--text-primary); font-weight: 500; }

.pomodoro-history__badge {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-weight: 500;
}

.pomodoro-history__badge--done { background: var(--color-success, #34c759); color: white; }
.pomodoro-history__badge--abandon { background: var(--color-border, #d2d2d7); color: var(--text-secondary); }

.pomodoro-history__empty {
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
  padding: var(--space-md);
}
</style>
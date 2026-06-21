<template>
  <div class="pomodoro-timer" :class="{ 'is-running': running, 'is-completed': completed }">
    <div class="pomodoro-timer__display">
      <span class="pomodoro-timer__time">{{ formatted }}</span>
    </div>
    <div v-if="completed" class="pomodoro-timer__status">专注完成！</div>
    <div v-else-if="running" class="pomodoro-timer__status">专注中…</div>
    <div v-else class="pomodoro-timer__status">准备开始</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  remaining: { type: Number, required: true },  // 秒
  running: { type: Boolean, default: false },
  completed: { type: Boolean, default: false },
})

const formatted = computed(() => {
  const m = Math.floor(props.remaining / 60)
  const s = props.remaining % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
})
</script>

<style scoped>
.pomodoro-timer {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-md);
  border-radius: var(--radius-md);
  background: var(--color-surface, #f5f5f7);
}

.pomodoro-timer__display {
  font-size: 48px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.pomodoro-timer.is-running .pomodoro-timer__display { color: var(--color-accent); }
.pomodoro-timer.is-completed .pomodoro-timer__display { color: var(--color-success); }

.pomodoro-timer__status {
  font-size: 14px;
  color: var(--text-secondary);
  margin-top: var(--space-xs);
}
</style>

<template>
  <div class="milestone-progress" :class="{ 'milestone-progress--achieved': achieved }">
    <div class="milestone-progress__label">
      <span>距 {{ nextMilestone }} 天里程碑</span>
      <span v-if="achieved" class="milestone-progress__check">✓</span>
    </div>
    <div class="milestone-progress__bar">
      <div
        class="milestone-progress__fill"
        :style="{ width: `${progressPercent}%` }"
      />
    </div>
    <div class="milestone-progress__caption">
      还差 {{ daysToNext }} 天
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  current: { type: Number, default: 0 },
  nextMilestone: { type: Number, default: 7 },
  daysToNext: { type: Number, default: 0 },
})

const progressPercent = computed(() => {
  if (props.nextMilestone <= 0) return 0
  if (props.daysToNext <= 0) return 100
  const base = props.nextMilestone - props.daysToNext
  return Math.min(100, Math.max(0, (base / props.nextMilestone) * 100))
})

const achieved = computed(() => props.daysToNext <= 0)
</script>

<style scoped>
.milestone-progress {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.milestone-progress__label {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--text-secondary);
}

.milestone-progress__check {
  color: var(--color-success, #34c759);
  font-weight: 700;
}

.milestone-progress__bar {
  height: 6px;
  background: var(--color-border, #d2d2d7);
  border-radius: var(--radius-full, 9999px);
  overflow: hidden;
}

.milestone-progress__fill {
  height: 100%;
  background: var(--color-accent, #0071e3);
  transition: width 0.4s ease;
}

.milestone-progress--achieved .milestone-progress__fill {
  background: var(--color-success, #34c759);
}

.milestone-progress__caption {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>

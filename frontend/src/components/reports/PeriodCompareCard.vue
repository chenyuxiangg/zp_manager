<template>
  <div class="period-compare-card">
    <h4 class="period-compare-card__title">{{ title }}</h4>
    <div class="period-compare-card__values">
      <div class="period-compare-card__current">
        <span class="period-compare-card__number">{{ current }}</span>
        <span class="period-compare-card__unit">{{ unit }}</span>
      </div>
      <div class="period-compare-card__delta" :class="deltaClass">
        <span>{{ deltaSymbol }}{{ Math.abs(delta) }}{{ unit }}</span>
        <span class="period-compare-card__pct">({{ deltaPct }}%)</span>
      </div>
    </div>
    <div class="period-compare-card__caption">对比上期</div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: { type: String, required: true },
  current: { type: Number, required: true },
  previous: { type: Number, default: 0 },
  unit: { type: String, default: '' },
})

const delta = computed(() => props.current - props.previous)
const deltaPct = computed(() => {
  if (props.previous === 0) return props.current > 0 ? '+∞' : '0'
  return Math.round((delta.value / props.previous) * 100)
})
const deltaSymbol = computed(() => delta.value >= 0 ? '+' : '-')
const deltaClass = computed(() => delta.value >= 0 ? 'is-up' : 'is-down')
</script>

<style scoped>
.period-compare-card {
  padding: var(--space-md);
  background: var(--color-surface, #f5f5f7);
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}
.period-compare-card__title {
  font-size: 14px;
  color: var(--text-secondary);
  font-weight: 500;
}
.period-compare-card__values {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}
.period-compare-card__number {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
}
.period-compare-card__unit { font-size: 13px; color: var(--text-secondary); }
.period-compare-card__delta.is-up { color: var(--color-success, #34c759); }
.period-compare-card__delta.is-down { color: var(--color-error, #ff3b30); }
.period-compare-card__pct { font-size: 12px; margin-left: 4px; opacity: 0.8; }
.period-compare-card__caption { font-size: 12px; color: var(--text-secondary); }
</style>

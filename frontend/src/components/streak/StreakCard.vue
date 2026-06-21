<template>
  <BaseCard elevation="raised" class="streak-card" data-guide="streak-card">
    <div class="streak-card__header">
      <StreakFlameIcon :current="current" />
      <div class="streak-card__title">
        <span class="streak-card__current">{{ current }}</span>
        <span class="streak-card__suffix">天</span>
      </div>
      <div class="streak-card__caption">连续学习</div>
    </div>
    <div class="streak-card__divider" />
    <div class="streak-card__meta">
      <span>历史最长 {{ longest }} 天</span>
    </div>
    <MilestoneProgress
      v-if="nextMilestone"
      :current="current"
      :next-milestone="nextMilestone"
      :days-to-next="daysToNext"
    />
    <p v-else class="streak-card__legend">🎉 已达成所有里程碑！</p>
  </BaseCard>
</template>

<script setup>
import BaseCard from '@/components/base/BaseCard.vue'
import StreakFlameIcon from './StreakFlameIcon.vue'
import MilestoneProgress from './MilestoneProgress.vue'

defineProps({
  current: { type: Number, default: 0 },
  longest: { type: Number, default: 0 },
  nextMilestone: { type: Number, default: 7 },
  daysToNext: { type: Number, default: 0 },
})
</script>

<style scoped>
.streak-card {
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.streak-card__header {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}

.streak-card__title {
  display: flex;
  align-items: baseline;
}

.streak-card__current {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
}

.streak-card__suffix {
  font-size: 14px;
  color: var(--text-secondary);
  margin-left: 2px;
}

.streak-card__caption {
  font-size: 14px;
  color: var(--text-secondary);
}

.streak-card__divider {
  height: 1px;
  background: var(--color-border-light, #e4e7ed);
}

.streak-card__meta {
  font-size: 13px;
  color: var(--text-secondary);
}

.streak-card__legend {
  font-size: 13px;
  color: var(--color-success, #34c759);
}
</style>

<template>
  <BaseCard elevation="raised" class="streak-milestone-card" data-guide="streak-milestones">
    <div class="streak-milestone-card__header">
      <span class="streak-milestone-card__icon" aria-hidden="true">🎯</span>
      <span class="streak-milestone-card__title">学习里程碑</span>
    </div>
    <div class="streak-milestone-card__divider" />
    <div class="streak-milestone-card__list">
      <MilestoneProgress
        v-for="m in milestones"
        :key="m.value"
        :current="current"
        :next-milestone="m.value"
        :days-to-next="m.daysToNext"
      />
    </div>
  </BaseCard>
</template>

<script setup>
// B0328-fix — StreakMilestoneCard: 同时展示 7/30/100 三个里程碑
// 复用 MilestoneProgress 子组件（DRY），通过 v-for 渲染 3 次
import { computed } from 'vue'
import BaseCard from '@/components/base/BaseCard.vue'
import MilestoneProgress from './MilestoneProgress.vue'

const props = defineProps({
  current: { type: Number, default: 0 },
  daysTo7: { type: Number, default: 0 },
  daysTo30: { type: Number, default: 0 },
  daysTo100: { type: Number, default: 0 },
})

const milestones = computed(() => [
  { value: 7, daysToNext: props.daysTo7 },
  { value: 30, daysToNext: props.daysTo30 },
  { value: 100, daysToNext: props.daysTo100 },
])
</script>

<style scoped>
.streak-milestone-card {
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.streak-milestone-card__header {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
}

.streak-milestone-card__icon {
  font-size: 20px;
}

.streak-milestone-card__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.streak-milestone-card__divider {
  height: 1px;
  background: var(--color-border-light, #e4e7ed);
  margin: 4px 0;
}

.streak-milestone-card__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
</style>
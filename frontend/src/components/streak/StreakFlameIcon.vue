<template>
  <svg
    class="streak-flame"
    :class="[`streak-flame--${state}`]"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
  >
    <!-- 简化的火焰 SVG path -->
    <path
      d="M12 2C12 2 7 6 7 11c0 3 2 5 5 5s5-2 5-5c0-2-1-3-2-4 0 2-1 3-2 3 0-3 1-5-1-8z"
      fill="currentColor"
    />
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  current: { type: Number, default: 0 },
  // state: 'inactive' | 'active' | 'hot' | 'on-fire'
})

const state = computed(() => {
  if (props.current <= 0) return 'inactive'
  if (props.current < 7) return 'active'
  if (props.current < 30) return 'hot'
  return 'on-fire'
})
</script>

<style scoped>
.streak-flame {
  display: inline-block;
  vertical-align: middle;
  transition: color 0.3s ease;
}

.streak-flame--inactive { color: var(--color-border, #d2d2d7); }
.streak-flame--active  { color: var(--color-warning, #ff9500); }
.streak-flame--hot     { color: var(--color-accent, #0071e3); }
.streak-flame--on-fire { color: var(--color-error, #ff3b30); animation: pulse 1.5s ease-in-out infinite; }

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.15); }
}

@media (prefers-reduced-motion: reduce) {
  .streak-flame--on-fire { animation: none; }
}
</style>

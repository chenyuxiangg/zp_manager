<template>
  <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" class="progress-ring">
    <!-- 底圈 -->
    <circle
      :cx="center"
      :cy="center"
      :r="radius"
      fill="none"
      :stroke="trackColor"
      :stroke-width="strokeWidth"
    />
    <!-- 进度圈 -->
    <circle
      :cx="center"
      :cy="center"
      :r="radius"
      fill="none"
      :stroke="color"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="dashOffset"
      transform="rotate(-90, center, center)"
      class="progress-circle"
    />
    <!-- 中心文字 -->
    <text
      v-if="showText"
      :x="center"
      :y="center"
      text-anchor="middle"
      dominant-baseline="central"
      :font-size="fontSize"
      :fill="textColor"
      class="progress-text"
    >
      {{ displayValue }}{{ unit }}
    </text>
  </svg>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: {
    type: Number,
    default: 0 // 0-100
  },
  size: {
    type: Number,
    default: 120
  },
  strokeWidth: {
    type: Number,
    default: 8
  },
  color: {
    type: String,
    default: 'var(--color-accent, #0071e3)'
  },
  trackColor: {
    type: String,
    default: 'var(--color-border, #d2d2d7)'
  },
  unit: {
    type: String,
    default: '%'
  },
  showText: {
    type: Boolean,
    default: true
  }
})

const center = computed(() => props.size / 2)
const radius = computed(() => (props.size - props.strokeWidth) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
const dashOffset = computed(() =>
  circumference.value * (1 - Math.min(Math.max(props.value, 0), 100) / 100)
)
const displayValue = computed(() => Math.round(props.value))
const fontSize = computed(() => props.size * 0.18)
const textColor = computed(() => 'var(--color-primary, #000)')
</script>

<style scoped>
.progress-ring {
  display: block;
}

.progress-circle {
  transition: stroke-dashoffset 0.8s ease;
}

.progress-text {
  font-weight: 600;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
</style>
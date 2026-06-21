<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="`0 0 ${size} ${size}`"
    class="progress-ring"
    :aria-label="label || `${displayValue}${unit}`"
    :role="label ? 'img' : 'presentation'"
  >
    <!-- 底圈 -->
    <circle
      :cx="center"
      :cy="center"
      :r="radius"
      fill="none"
      :stroke="trackColor"
      :stroke-width="effectiveStrokeWidth"
    />
    <!-- 进度圈 -->
    <circle
      :cx="center"
      :cy="center"
      :r="radius"
      fill="none"
      :stroke="color"
      :stroke-width="effectiveStrokeWidth"
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
  // B0252: thickness alias
  thickness: {
    type: Number,
    default: null,  // null → fall back to strokeWidth
  },
  // B0252: 方向 (Pomodoro 倒计时场景需要 'countdown')
  direction: {
    type: String,
    default: 'progress',  // 'progress' | 'countdown'
    validator: (v) => ['progress', 'countdown'].includes(v),
  },
  // B0252: tooltip 标签
  label: {
    type: String,
    default: '',
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
const effectiveStrokeWidth = computed(() => props.thickness ?? props.strokeWidth)
const radius = computed(() => (props.size - effectiveStrokeWidth.value) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)
// B0252: countdown 方向时，value=remaining, 显示 reverse progress
const effectiveValue = computed(() => {
  if (props.direction === 'countdown') return 100 - props.value
  return props.value
})
const dashOffset = computed(() =>
  circumference.value * (1 - Math.min(Math.max(effectiveValue.value, 0), 100) / 100)
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
<template>
  <!-- B0272: Teleport 到 body，避免父组件 overflow 裁剪 -->
  <Teleport to="body">
    <Transition name="float-up">
      <div
        v-if="visible"
        :class="['points-float', computedType]"
        :style="{ top: `${currentTop}px`, left: `${currentLeft}px` }"
        aria-live="polite"
        :aria-label="ariaLabel"
      >
        {{ displayText }}
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
// B0273: trigger 改为 Object (useFeedback 事件) — 旧 value+type API 已废弃
import { ref, computed, watch, onBeforeUnmount } from 'vue'

const props = defineProps({
  trigger: {
    type: Object,  // { type:'float', id, x, y, points_delta, view_id } | null
    default: null,
  },
  duration: { type: Number, default: 1500 },
  fallbackTop: { type: Number, default: 100 },
  fallbackLeft: { type: Number, default: 50 },
})

const emit = defineEmits(['done'])
const visible = ref(false)
const currentTop = ref(0)
const currentLeft = ref(0)
const currentDelta = ref(0)
let lastHandledId = null
let hideTimer = null

const computedType = computed(() => currentDelta.value >= 0 ? 'gain' : 'spend')
const displayText = computed(() => {
  const sign = computedType.value === 'gain' ? '+' : '-'
  return `${sign}${Math.abs(currentDelta.value)}`
})
const ariaLabel = computed(() => `${computedType.value === 'gain' ? '获得' : '失去'} ${Math.abs(currentDelta.value)} 积分`)

function show(x, y, delta) {
  currentTop.value = x ?? props.fallbackTop
  currentLeft.value = y ?? props.fallbackLeft
  currentDelta.value = delta
  visible.value = true
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    visible.value = false
    emit('done')
  }, props.duration)
}

watch(() => props.trigger, (v) => {
  if (!v || v.type !== 'float') return
  if (v.id && v.id === lastHandledId) return  // 去重
  lastHandledId = v.id
  show(v.x, v.y, v.points_delta)
})

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer)
})

defineExpose({ show })
</script>

<style scoped>
.points-float {
  position: fixed;
  font-size: 24px;
  font-weight: 700;
  pointer-events: none;
  /* B0271: 改用 token 变量 */
  z-index: var(--z-toast);
  text-shadow: 0 2px 8px var(--shadow-color-strong);
}

.points-float.gain {
  color: var(--color-success);
}

.points-float.spend {
  color: var(--color-error);
}

.float-up-enter-active {
  animation: float-up-animation 1.5s ease-out forwards;
}

.float-up-leave-active {
  animation: float-up-animation 0.3s ease-out forwards;
}

@keyframes float-up-animation {
  0%   { opacity: 1; transform: translateY(0) scale(1); }
  50%  { opacity: 1; transform: translateY(-30px) scale(1.1); }
  100% { opacity: 0; transform: translateY(-60px) scale(0.8); }
}

/* B0087: prefers-reduced-motion 时禁用动画 */
@media (prefers-reduced-motion: reduce) {
  .points-float,
  .float-up-enter-active,
  .float-up-leave-active {
    animation: none !important;
    transition: none !important;
  }
}
</style>

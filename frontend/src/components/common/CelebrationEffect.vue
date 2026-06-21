<template>
  <!-- B0272: Teleport 到 body，避免父组件 overflow 裁剪 -->
  <Teleport to="body">
    <div ref="containerRef" class="celebration-container" />
  </Teleport>
</template>

<script setup>
// B0273: trigger 改为 Object (useFeedback 事件) — 旧 Boolean API 已废弃
import { ref, watch, onBeforeUnmount } from 'vue'
import confetti from 'canvas-confetti'

const props = defineProps({
  trigger: {
    type: Object,  // { type:'celebrate', id, x, y, points_delta, view_id } | null
    default: null,
  },
  options: {
    type: Object,
    default: () => ({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0071e3', '#34c759', '#ff9500', '#ff3b30'],
    }),
  },
})

const emit = defineEmits(['complete'])
const containerRef = ref(null)
let lastHandledId = null  // 防止同一事件触发多次
let timers = []

function clearTimers() {
  for (const t of timers) clearTimeout(t)
  timers = []
}

function celebrate() {
  const defaults = {
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#0071e3', '#34c759', '#ff9500', '#ff3b30'],
  }
  confetti({ ...defaults, ...props.options, drift: 0, gravity: 1, scalar: 1, shapes: ['circle', 'square'] })
  timers.push(setTimeout(() => {
    confetti({ ...defaults, particleCount: 40, spread: 100, origin: { y: 0.7 }, startVelocity: 45 })
  }, 200))
  timers.push(setTimeout(() => emit('complete'), 1500))
}

// 仅在 trigger.type === 'celebrate' 时触发
watch(() => props.trigger, (v) => {
  if (!v || v.type !== 'celebrate') return
  if (v.id && v.id === lastHandledId) return  // 去重
  lastHandledId = v.id
  celebrate()
})

onBeforeUnmount(() => {
  clearTimers()
})

defineExpose({ celebrate })
</script>

<style scoped>
.celebration-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  /* B0271: 改用 token 变量 */
  z-index: var(--z-toast);
}
</style>

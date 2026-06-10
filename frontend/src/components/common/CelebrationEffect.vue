<template>
  <div ref="containerRef" class="celebration-container"></div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import confetti from 'canvas-confetti'

const props = defineProps({
  trigger: {
    type: Boolean,
    default: false
  },
  options: {
    type: Object,
    default: () => ({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0071e3', '#34c759', '#ff9500', '#ff3b30']
    })
  }
})

const emit = defineEmits(['complete'])
const containerRef = ref(null)

const celebrate = () => {
  const defaults = {
    particleCount: 80,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#0071e3', '#34c759', '#ff9500', '#ff3b30']
  }

  // 发送礼花
  confetti({
    ...defaults,
    ...props.options,
    drift: 0,
    gravity: 1,
    scalar: 1,
    shapes: ['circle', 'square']
  })

  // 延迟再发一次，增加效果
  setTimeout(() => {
    confetti({
      ...defaults,
      particleCount: 40,
      spread: 100,
      origin: { y: 0.7 },
      startVelocity: 45
    })
  }, 200)

  // 完成回调
  setTimeout(() => {
    emit('complete')
  }, 1500)
}

// 监听 trigger 属性变化
import { watch } from 'vue'
watch(() => props.trigger, (newVal) => {
  if (newVal) {
    celebrate()
  }
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
  z-index: 9998;
}
</style>
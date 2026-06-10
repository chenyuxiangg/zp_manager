<template>
  <Transition name="float-up">
    <div
      v-if="visible"
      :class="['points-float', type]"
      :style="{ top: `${top}px`, left: `${left}px` }"
    >
      {{ displayText }}
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  value: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    default: 'gain', // 'gain' | 'spend'
    validator: (v) => ['gain', 'spend'].includes(v)
  },
  duration: {
    type: Number,
    default: 1500
  },
  top: {
    type: Number,
    default: 100
  },
  left: {
    type: Number,
    default: 50
  }
})

const emit = defineEmits(['done'])
const visible = ref(false)

const displayText = computed(() => {
  const sign = props.type === 'gain' ? '+' : '-'
  return `${sign}${Math.abs(props.value)}`
})

function show() {
  visible.value = true
  setTimeout(() => {
    visible.value = false
    emit('done')
  }, props.duration)
}

// 监听 value 变化
watch(() => props.value, () => {
  show()
})

defineExpose({ show })
</script>

<style scoped>
.points-float {
  position: fixed;
  font-size: 24px;
  font-weight: 700;
  pointer-events: none;
  z-index: 9999;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.points-float.gain {
  color: var(--color-success, #34c759);
}

.points-float.spend {
  color: var(--color-error, #ff3b30);
}

.float-up-enter-active {
  animation: float-up-animation 1.5s ease-out forwards;
}

.float-up-leave-active {
  animation: float-up-animation 0.3s ease-out forwards;
}

@keyframes float-up-animation {
  0% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
  50% {
    opacity: 1;
    transform: translateY(-30px) scale(1.1);
  }
  100% {
    opacity: 0;
    transform: translateY(-60px) scale(0.8);
  }
}
</style>
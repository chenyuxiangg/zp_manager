<template>
  <div v-if="enabled" ref="driverRef" class="new-user-guide">
    <!-- driver.js 会自动注入到页面 -->
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import Driver from 'driver.js'
import 'driver.js/dist/driver.css'

const props = defineProps({
  steps: {
    type: Array,
    required: true
    // [{ element: '.selector', popover: { title, description, position } }]
  },
  enabledKey: {
    type: String,
    required: true
  },
  autoStart: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['complete', 'close'])
const enabled = ref(true)
const driverRef = ref(null)
let driver = null

const isCompleted = () => {
  try {
    return localStorage.getItem(props.enabledKey) === 'true'
  } catch {
    return false
  }
}

const markCompleted = () => {
  try {
    localStorage.setItem(props.enabledKey, 'true')
  } catch {
    // ignore
  }
}

const initDriver = () => {
  driver = new Driver({
    animate: true,
    opacity: 0.75,
    padding: 5,
    allowClose: true,
    doneBtnText: '完成',
    nextBtnText: '下一步',
    prevBtnText: '上一步',
    onReset: () => {
      markCompleted()
      emit('close')
    },
    onDestroyed: () => {
      markCompleted()
      emit('complete')
    }
  })

  driver.defineSteps(props.steps.map(s => ({
    element: s.element,
    popover: {
      title: s.popover.title,
      description: s.popover.description,
      position: s.popover.position || 'bottom'
    }
  })))
}

const start = () => {
  if (!driver) {
    initDriver()
  }
  driver.start()
}

const reset = () => {
  if (driver) {
    driver.reset()
  }
}

watch(() => props.enabledKey, () => {
  if (isCompleted()) {
    enabled.value = false
  }
}, { immediate: true })

onMounted(() => {
  if (isCompleted()) {
    enabled.value = false
    return
  }

  initDriver()

  if (props.autoStart) {
    setTimeout(() => {
      start()
    }, 800)
  }
})

defineExpose({ start, reset })
</script>

<style scoped>
.new-user-guide {
  position: fixed;
  inset: 0;
  z-index: 9997;
  pointer-events: none;
}
</style>
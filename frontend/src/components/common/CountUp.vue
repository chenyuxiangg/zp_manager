<template>
  <span class="count-up">{{ displayValue }}</span>
</template>

<script setup>
import { watch } from 'vue'
import { useCountUp } from '@/composables/useCountUp'

const props = defineProps({
  value: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    default: 1000
  }
})

const { displayValue, start } = useCountUp({ duration: props.duration })

watch(() => props.value, (newVal) => {
  start(newVal)
}, { immediate: true })

defineExpose({ start })
</script>

<style scoped>
.count-up {
  font-variant-numeric: tabular-nums;
}
</style>
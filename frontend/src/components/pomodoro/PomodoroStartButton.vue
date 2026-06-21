<template>
  <BaseButton
    :variant="running ? 'danger' : 'primary'"
    :loading="starting"
    @click="handleClick"
  >
    {{ running ? '结束专注' : '开始专注' }}
  </BaseButton>
</template>

<script setup>
import BaseButton from '@/components/base/BaseButton.vue'

const props = defineProps({
  running: { type: Boolean, default: false },
  starting: { type: Boolean, default: false },
})

const emit = defineEmits(['start', 'stop'])

function handleClick() {
  if (props.running) {
    emit('stop')
  } else {
    emit('start')
  }
}
</script>

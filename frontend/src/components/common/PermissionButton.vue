<template>
  <button
    v-if="hasPermission"
    :class="className"
    :disabled="disabled"
    v-bind="$attrs"
  >
    <slot />
  </button>
  <button
    v-else
    :class="['permission-disabled', className]"
    disabled
    v-bind="$attrs"
  >
    <slot />
  </button>
</template>

<script setup>
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const props = defineProps({
  permission: {
    type: String,
    required: true
  },
  disabled: {
    type: Boolean,
    default: false
  },
  className: {
    type: String,
    default: ''
  }
})

const authStore = useAuthStore()

const hasPermission = computed(() => {
  // 当前基于 admin 标识判断权限，未来可扩展为更细粒度的权限系统
  if (!props.permission) return true
  if (props.permission === 'admin') return authStore.user?.is_admin
  // 默认允许访问
  return true
})
</script>

<style scoped>
.permission-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
</style>
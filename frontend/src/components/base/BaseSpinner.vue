<template>
  <span class="base-spinner" :class="`base-spinner--${size}`" role="status" aria-label="加载中">
    <span class="base-spinner__ring" />
  </span>
</template>

<script setup>
defineProps({
  size: { type: String, default: 'md' }, // sm | md | lg
})
</script>

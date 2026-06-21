<template>
  <span class="base-tag" :class="[`base-tag--${variant}`, `base-tag--${size}`]">
    <slot />
  </span>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'neutral' }, // neutral | success | warning | error | info
  size:    { type: String, default: 'md' },       // sm | md
})
</script>

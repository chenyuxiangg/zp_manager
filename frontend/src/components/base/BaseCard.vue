<template>
  <div class="base-card" :class="[`base-card--${elevation}`, `base-card--padding-${padding}`]">
    <slot name="header" />
    <div class="base-card__body">
      <slot />
    </div>
    <slot name="footer" />
  </div>
</template>

<script setup>
defineProps({
  elevation: { type: String, default: 'flat' },   // flat | raised | floating
  padding:   { type: String, default: 'md' },     // sm | md | lg
})
</script>

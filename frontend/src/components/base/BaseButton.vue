<template>
  <button
    class="base-button"
    :class="[
      `base-button--${variant}`,
      `base-button--${size}`,
      { 'base-button--block': block, 'base-button--loading': loading }
    ]"
    :disabled="disabled || loading"
    :type="type"
    @click="onClick"
  >
    <span v-if="loading" class="base-button__spinner" aria-hidden="true" />
    <span class="base-button__content" :class="{ 'is-loading': loading }">
      <slot />
    </span>
  </button>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'primary' }, // primary | secondary | ghost | danger | success
  size:    { type: String, default: 'md' },       // sm | md | lg
  type:    { type: String, default: 'button' },
  loading: { type: Boolean, default: false },
  disabled:{ type: Boolean, default: false },
  block:   { type: Boolean, default: false },
})
const emit = defineEmits(['click'])
function onClick(e) { emit('click', e) }
</script>

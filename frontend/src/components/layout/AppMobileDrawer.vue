<template>
  <Teleport to="body">
    <div v-if="visible" class="app-drawer-overlay" @click="$emit('close')">
      <aside class="app-drawer" @click.stop>
        <slot />
      </aside>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({ visible: { type: Boolean, default: false } })
defineEmits(['close'])
</script>

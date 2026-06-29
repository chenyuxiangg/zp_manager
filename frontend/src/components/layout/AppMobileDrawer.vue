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

<!--
  设计稿来源：e046a64 (RR1) App.vue:143-176 (.drawer-overlay + .drawer)
  - overlay: fixed 满屏, var(--color-overlay), z-index 999 (比汉堡高)
  - drawer: 左侧 280px 滑入, 100vh, 玻璃底 (var(--color-surface-glass) + blur(20px))
  - 动画复用全局 fade-in / slide-in (animations.css)
-->
<style scoped>
.app-drawer-overlay {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
  z-index: var(--z-modal);
  animation: fade-in var(--transition-base);
}

.app-drawer {
  position: fixed;
  top: 0;
  left: 0;
  width: 280px;
  height: 100vh;
  background: var(--color-surface-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  z-index: var(--z-modal);
  animation: slide-in var(--transition-slow);
}
</style>

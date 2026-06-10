<template>
  <Teleport to="body">
    <div class="toast-container" v-if="toasts.length > 0">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast-${toast.type}`]"
        >
          <div class="toast-icon">
            <span v-if="toast.type === 'success'">✓</span>
            <span v-else-if="toast.type === 'error'">✕</span>
            <span v-else-if="toast.type === 'warning'">!</span>
            <span v-else-if="toast.type === 'info'">ℹ</span>
            <span v-else-if="toast.type === 'loading'" class="loading-spinner">⟳</span>
          </div>
          <div class="toast-message">{{ toast.message }}</div>
          <button class="toast-close" @click="remove(toast.id)">×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToast } from '@/composables/useToast'

const { toasts, remove } = useToast()
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 360px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  background: white;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12), 0 2px 4px rgba(0, 0, 0, 0.08);
  font-size: 14px;
  line-height: 1.4;
}

.toast-success {
  border-left: 4px solid var(--color-success, #34c759);
}

.toast-error {
  border-left: 4px solid var(--color-error, #ff3b30);
}

.toast-warning {
  border-left: 4px solid var(--color-warning, #ff9500);
}

.toast-info {
  border-left: 4px solid var(--color-accent, #0071e3);
}

.toast-loading {
  border-left: 4px solid var(--color-secondary, #6e6e73);
}

.toast-icon {
  font-size: 16px;
  font-weight: 600;
  width: 20px;
  text-align: center;
}

.toast-success .toast-icon { color: var(--color-success, #34c759); }
.toast-error .toast-icon { color: var(--color-error, #ff3b30); }
.toast-warning .toast-icon { color: var(--color-warning, #ff9500); }
.toast-info .toast-icon { color: var(--color-accent, #0071e3); }
.toast-loading .toast-icon { color: var(--color-secondary, #6e6e73); }

.loading-spinner {
  display: inline-block;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.toast-message {
  flex: 1;
  color: var(--color-primary, #000);
}

.toast-close {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--color-secondary, #6e6e73);
  cursor: pointer;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.toast-close:hover {
  background: var(--color-surface, #f5f5f7);
}

/* 过渡动画 */
.toast-enter-active {
  animation: toast-in 0.3s ease;
}

.toast-leave-active {
  animation: toast-out 0.3s ease;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(100px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes toast-out {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(100px);
  }
}
</style>
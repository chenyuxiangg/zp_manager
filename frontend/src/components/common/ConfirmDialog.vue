<template>
  <Teleport to="body">
    <div v-if="visible" class="confirm-overlay" @click.self="handleCancel">
      <div class="confirm-dialog glass" role="dialog" aria-modal="true">
        <h3>{{ title }}</h3>
        <p>{{ message }}</p>
        <div class="confirm-actions">
          <BaseButton variant="secondary" @click="handleCancel" :disabled="loading">
            {{ cancelText }}
          </BaseButton>
          <BaseButton :variant="isDanger ? 'danger' : 'primary'" :loading="loading" @click="handleConfirm">
            {{ loading ? '处理中...' : confirmText }}
          </BaseButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import BaseButton from '@/components/base/BaseButton.vue'
defineProps({
  visible: Boolean,
  title: {
    type: String,
    default: '确认操作'
  },
  message: {
    type: String,
    default: '确定要执行此操作吗？'
  },
  confirmText: {
    type: String,
    default: '确认'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  isDanger: {
    type: Boolean,
    default: false
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['confirm', 'cancel'])

function handleConfirm() {
  emit('confirm')
}

function handleCancel() {
  emit('cancel')
}
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fade-in 0.2s ease;
}

.confirm-dialog {
  width: 100%;
  max-width: 400px;
  padding: var(--space-xl);
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: var(--color-background, white);
  animation: scale-in 0.2s ease;
}

h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--color-primary);
}

p {
  font-size: 14px;
  color: var(--color-secondary);
  margin-bottom: var(--space-lg);
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}

.btn-cancel, .btn-confirm {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.btn-cancel {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-secondary);
}

.btn-cancel:hover:not(:disabled) {
  background: var(--color-surface);
}

.btn-confirm {
  background: var(--color-accent);
  border: none;
  color: white;
}

.btn-confirm:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-confirm.danger {
  background: var(--color-error);
}

.btn-confirm:active:not(:disabled),
.btn-cancel:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-cancel:disabled, .btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
<template>
  <div class="network-error">
    <div class="icon">🌐</div>
    <h2>网络连接失败</h2>
    <p>{{ message }}</p>
    <button @click="handleRetry" class="btn-primary">
      {{ loading ? '重新加载中...' : '重新加载' }}
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  message: {
    type: String,
    default: '请检查网络连接后重试'
  }
})

const emit = defineEmits(['retry'])
const loading = ref(false)

function handleRetry() {
  loading.value = true
  emit('retry')
  setTimeout(() => {
    loading.value = false
  }, 2000)
}
</script>

<style scoped>
.network-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: var(--space-xl);
  text-align: center;
  background: var(--color-surface);
}

.icon {
  font-size: 64px;
  margin-bottom: var(--space-lg);
}

h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--color-primary);
}

p {
  font-size: 14px;
  color: var(--color-secondary);
  margin-bottom: var(--space-lg);
  max-width: 300px;
}

.btn-primary {
  padding: 12px 24px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
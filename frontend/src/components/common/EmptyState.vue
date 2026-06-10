<template>
  <div class="empty-state">
    <div class="icon">{{ icon }}</div>
    <h3>{{ title }}</h3>
    <p v-if="description">{{ description }}</p>
    <button v-if="actionText" @click="$emit('action')" class="btn-primary">
      {{ actionText }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  icon: {
    type: String,
    default: '📋'
  },
  title: {
    type: String,
    required: true
  },
  description: String,
  actionText: String
})

defineEmits(['action'])
</script>

<style scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-2xl);
  text-align: center;
}

.icon {
  font-size: 48px;
  margin-bottom: var(--space-md);
}

h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-primary);
  margin-bottom: var(--space-sm);
}

p {
  font-size: 14px;
  color: var(--color-secondary);
  margin-bottom: var(--space-lg);
  max-width: 300px;
}

.btn-primary {
  padding: 10px 20px;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
}

.btn-primary:hover {
  opacity: 0.9;
}

.btn-primary:active {
  transform: scale(0.98);
}
</style>
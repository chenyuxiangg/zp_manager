<template>
  <div class="skeleton" :class="variant">
    <div v-if="variant === 'card'" class="skeleton-card">
      <div class="skeleton-title"></div>
      <div class="skeleton-meta"></div>
      <div class="skeleton-tags"></div>
    </div>
    <div v-else-if="variant === 'text'" class="skeleton-text">
      <div class="skeleton-line" v-for="i in lines" :key="i" :style="{ width: widths[i-1] || '100%' }"></div>
    </div>
    <div v-else-if="variant === 'avatar'" class="skeleton-avatar"></div>
    <div v-else class="skeleton-block"></div>
  </div>
</template>

<script setup>
defineProps({
  variant: {
    type: String,
    default: 'block' // 'block' | 'card' | 'text' | 'avatar'
  },
  lines: {
    type: Number,
    default: 3
  },
  widths: {
    type: Array,
    default: () => ['100%', '80%', '60%']
  }
})
</script>

<style scoped>
.skeleton {
  background: linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-mid) 50%, var(--skeleton-end) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.skeleton-block {
  width: 100%;
  height: 20px;
}

.skeleton-card {
  padding: 16px;
  border-radius: 12px;
}

.skeleton-title {
  height: 20px;
  width: 60%;
  margin-bottom: 12px;
  border-radius: 4px;
}

.skeleton-meta {
  height: 14px;
  width: 40%;
  margin-bottom: 8px;
  border-radius: 4px;
}

.skeleton-tags {
  height: 14px;
  width: 80%;
  border-radius: 4px;
}

.skeleton-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.skeleton-line {
  height: 14px;
  border-radius: 4px;
}

.skeleton-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}
</style>
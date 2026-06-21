<template>
  <div class="plans-skeleton" v-if="loading">
    <div class="skeleton-header"></div>
    <div class="skeleton-grid">
      <div v-for="i in 6" :key="i" class="skeleton-card">
        <div class="skeleton-title"></div>
        <div class="skeleton-desc"></div>
        <div class="skeleton-meta"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  loading: Boolean
})
</script>

<style scoped>
.plans-skeleton {
  width: 100%;
}

.skeleton-header {
  height: 40px;
  width: 200px;
  margin-bottom: 24px;
  background: linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-mid) 50%, var(--skeleton-end) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 8px;
}

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.skeleton-card {
  padding: 24px;
  background: white;
  border-radius: 12px;
  border: 1px solid var(--color-border, #d2d2d7);
}

.skeleton-title {
  height: 20px;
  width: 60%;
  margin-bottom: 12px;
  background: linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-mid) 50%, var(--skeleton-end) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-desc {
  height: 14px;
  width: 80%;
  margin-bottom: 16px;
  background: linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-mid) 50%, var(--skeleton-end) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.skeleton-meta {
  height: 12px;
  width: 40%;
  background: linear-gradient(90deg, var(--skeleton-base) 25%, var(--skeleton-mid) 50%, var(--skeleton-end) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
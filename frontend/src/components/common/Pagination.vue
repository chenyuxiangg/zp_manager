<template>
  <div class="pagination" v-if="total > 0">
    <button
      class="page-btn"
      :disabled="currentPage <= 1"
      @click="goToPage(currentPage - 1)"
    >
      ‹
    </button>
    <button
      v-for="page in displayedPages"
      :key="page"
      :class="['page-btn', { active: page === currentPage, ellipsis: page === '...' }]"
      :disabled="page === '...'"
      @click="page !== '...' && goToPage(page)"
    >
      {{ page }}
    </button>
    <button
      class="page-btn"
      :disabled="currentPage >= totalPages"
      @click="goToPage(currentPage + 1)"
    >
      ›
    </button>
    <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentPage: {
    type: Number,
    default: 1
  },
  totalPages: {
    type: Number,
    required: true
  },
  maxButtons: {
    type: Number,
    default: 5
  }
})

const emit = defineEmits(['update:currentPage', 'page-change'])

function goToPage(page) {
  if (page < 1 || page > props.totalPages || page === props.currentPage) return
  emit('update:currentPage', page)
  emit('page-change', page)
}

const displayedPages = computed(() => {
  const pages = []
  const total = props.totalPages
  const current = props.currentPage
  const max = props.maxButtons

  if (total <= max) {
    for (let i = 1; i <= total; i++) pages.push(i)
  } else {
    let start = Math.max(1, current - Math.floor(max / 2))
    let end = Math.min(total, start + max - 1)

    if (end - start < max - 1) {
      start = Math.max(1, end - max + 1)
    }

    if (start > 1) {
      pages.push(1)
      if (start > 2) pages.push('...')
    }

    for (let i = start; i <= end; i++) pages.push(i)

    if (end < total) {
      if (end < total - 1) pages.push('...')
      pages.push(total)
    }
  }

  return pages
})
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: center;
  margin-top: 24px;
}

.page-btn {
  min-width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border, #d2d2d7);
  background: white;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0 8px;
}

.page-btn:hover:not(:disabled):not(.ellipsis) {
  border-color: var(--color-accent, #0071e3);
  color: var(--color-accent, #0071e3);
}

.page-btn.active {
  background: var(--color-accent, #0071e3);
  color: white;
  border-color: var(--color-accent, #0071e3);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-btn.ellipsis {
  border: none;
  cursor: default;
}

.page-info {
  margin-left: 12px;
  font-size: 13px;
  color: var(--color-secondary, #6e6e73);
}
</style>
<template>
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <ol>
      <li v-for="(crumb, index) in crumbs" :key="index">
        <router-link v-if="crumb.path" :to="crumb.path">
          {{ crumb.label }}
        </router-link>
        <span v-else class="current">{{ crumb.label }}</span>
        <span v-if="index < crumbs.length - 1" class="separator">/</span>
      </li>
    </ol>
  </nav>
</template>

<script setup>
defineProps({
  crumbs: {
    type: Array,
    required: true,
    // [{ label: '计划', path: '/plans' }, { label: '详情', path: null }]
  }
})
</script>

<style scoped>
.breadcrumb {
  padding: 8px 0;
  margin-bottom: 16px;
}

.breadcrumb ol {
  display: flex;
  align-items: center;
  list-style: none;
  gap: 8px;
  font-size: 14px;
}

.breadcrumb li {
  display: flex;
  align-items: center;
  gap: 8px;
}

.breadcrumb a {
  color: var(--color-accent, #0071e3);
  text-decoration: none;
  transition: color 0.2s;
}

.breadcrumb a:hover {
  color: var(--color-primary, #000);
  text-decoration: underline;
}

.breadcrumb .current {
  color: var(--color-secondary, #6e6e73);
}

.breadcrumb .separator {
  color: var(--color-border, #d2d2d7);
}
</style>
<template>
  <div class="mobile-fallback-table">
    <h4 class="mobile-fallback-table__title">{{ title }}</h4>
    <table class="mobile-fallback-table__table">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key">{{ col.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in rows" :key="i">
          <td v-for="col in columns" :key="col.key">{{ row[col.key] }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
defineProps({
  title: { type: String, required: true },
  columns: { type: Array, required: true },  // [{ key, label }]
  rows: { type: Array, default: () => [] },
})
</script>

<style scoped>
.mobile-fallback-table {
  width: 100%;
  overflow-x: auto;
}
.mobile-fallback-table__title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: var(--space-sm);
  color: var(--text-primary);
}
.mobile-fallback-table__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.mobile-fallback-table__table th,
.mobile-fallback-table__table td {
  text-align: left;
  padding: var(--space-xs) var(--space-sm);
  border-bottom: 1px solid var(--color-border-light, #e4e7ed);
}
.mobile-fallback-table__table th {
  color: var(--text-secondary);
  font-weight: 500;
}
</style>

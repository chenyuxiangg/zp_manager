<template>
  <div class="base-card" :class="[`base-card--${elevation}`, `base-card--padding-${padding}`]">
    <slot name="header" />
    <div class="base-card__body">
      <slot />
    </div>
    <slot name="footer" />
  </div>
</template>

<script setup>
defineProps({
  elevation: { type: String, default: 'flat' },   // flat | raised | floating
  padding:   { type: String, default: 'md' },     // sm | md | lg
})
</script>

<style scoped>
/* 与 Plans/PlanDetail/Dashboard 卡片风格统一：
 *   - 1px 半透白边 + 12px 圆角 + 浅灰底
 *   - padding 由 padding prop 控制（sm=12 / md=16 / lg=24）
 *   - elevation=raised 叠加柔和阴影 + 悬停浮起
 */
.base-card {
  background: var(--color-background);
  border: 1px solid var(--color-card-border);
  border-radius: 12px;
  transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
}
.base-card--padding-sm { padding: var(--space-sm); }
.base-card--padding-md { padding: var(--space-md); }
.base-card--padding-lg { padding: var(--space-lg); }

.base-card--raised {
  box-shadow: 0 2px 8px var(--shadow-color-faint);
}
.base-card--raised:hover {
  box-shadow: 0 4px 12px var(--shadow-color-soft);
}
.base-card--floating {
  box-shadow: 0 8px 24px var(--shadow-color-medium);
}
</style>

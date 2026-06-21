<template>
  <BaseButton
    variant="ghost"
    size="sm"
    :aria-label="`当前主题: ${themeLabel}，点击切换`"
    @click="toggleTheme"
  >
    <span class="theme-switcher__icon">{{ themeIcon }}</span>
    <span class="theme-switcher__label">{{ themeLabel }}</span>
  </BaseButton>
</template>

<script setup>
import { computed } from 'vue'
import BaseButton from '@/components/base/BaseButton.vue'
import { useTheme } from '@/composables/useTheme'

const { theme, toggleTheme } = useTheme()

const themeIcon = computed(() => {
  if (theme.value === 'light') return '☀️'
  if (theme.value === 'dark') return '🌙'
  return '🖥️'  // system
})

const themeLabel = computed(() => {
  if (theme.value === 'light') return '浅色'
  if (theme.value === 'dark') return '深色'
  return '跟随系统'
})
</script>

<style scoped>
.theme-switcher__icon {
  margin-right: 4px;
  font-size: 16px;
}
.theme-switcher__label {
  font-size: 13px;
}
</style>

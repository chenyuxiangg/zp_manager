<template>
  <header class="app-header" :class="{ 'is-mobile': isMobile }">
    <div class="app-header__inner">
      <div class="app-header__logo">Zpersion</div>
      <nav class="app-header__nav">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          :data-guide="item.dataGuide"
        >{{ item.label }}</router-link>
      </nav>
      <div class="app-header__actions">
        <!-- B0298: ThemeSwitcher 始终可见（用户 UI 入口） -->
        <ThemeSwitcher />
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>

<script setup>
// B0295: 统一 nav 配置
import { computed } from 'vue'
import { NAV_ITEMS } from '@/composables/useNavConfig'
import { useAuthStore } from '@/stores/auth'
// B0298: 挂载 ThemeSwitcher
import ThemeSwitcher from '@/components/common/ThemeSwitcher.vue'

const props = defineProps({ isMobile: { type: Boolean, default: false } })
const auth = useAuthStore()
const navItems = computed(() =>
  NAV_ITEMS.filter(i => !i.requiresAdmin || auth.user?.is_admin)
)
</script>

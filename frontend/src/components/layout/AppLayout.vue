<template>
  <div class="app-layout">
    <AppHeader />
    <AppMobileDrawer :visible="drawerVisible" @close="drawerVisible = false">
      <!-- B0306: 用 NAV_ITEMS 替代硬编码 5 个 router-link -->
      <nav>
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          @click="drawerVisible = false"
        >{{ item.label }}</router-link>
      </nav>
    </AppMobileDrawer>
    <button v-if="isMobile" class="app-layout__hamburger" @click="drawerVisible = true" aria-label="打开菜单">☰</button>
    <main class="app-layout__main">
      <slot />
    </main>
    <AppFooter />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppHeader from './AppHeader.vue'
import AppMobileDrawer from './AppMobileDrawer.vue'
import AppFooter from './AppFooter.vue'
// B0306: 复用 useNavConfig，与 AppHeader 保持单一数据源
import { NAV_ITEMS } from '@/composables/useNavConfig'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const isMobile = ref(false)
const drawerVisible = ref(false)
function checkMobile() { isMobile.value = window.innerWidth < 768 }
onMounted(() => { checkMobile(); window.addEventListener('resize', checkMobile) })
onUnmounted(() => { window.removeEventListener('resize', checkMobile) })

// 与 AppHeader 同款：filter 掉 requiresAdmin 项（admin 守卫交给链接层）
const navItems = computed(() =>
  NAV_ITEMS.filter(i => !i.requiresAdmin || auth.user?.is_admin)
)
</script>
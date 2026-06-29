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

<!--
  设计稿来源：e046a64 (RR1) App.vue:108-130 (.hamburger-btn)
  - shell: min-height 100vh, flex 列, surface 背景
  - main: 1200px 居中, padding xl lg, flex 1 让 footer 贴底
  - 汉堡: 56px 圆按钮, 右下角悬浮, accent 色, z-index 998 (drawer overlay 是 999)
  - 桌面端 (>=768px) 隐藏汉堡 — 桌面 nav 由 AppHeader 接管
-->
<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
}

.app-layout__main {
  flex: 1;
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: var(--space-xl) var(--space-lg);
}

.app-layout__hamburger {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-accent);
  color: white;
  box-shadow: 0 4px 12px var(--shadow-color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  cursor: pointer;
  z-index: var(--z-sticky);
  transition: transform var(--transition-base), box-shadow var(--transition-base);
}

.app-layout__hamburger:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px var(--shadow-color-accent-strong);
}

.app-layout__hamburger:active {
  transform: scale(0.95);
}

@media (min-width: 768px) {
  .app-layout__hamburger {
    display: none;
  }
}
</style>
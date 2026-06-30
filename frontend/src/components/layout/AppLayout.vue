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
      <!-- B0341: 移动端抽屉底部登出入口 -->
      <div class="app-drawer__footer">
        <button
          class="app-drawer__logout"
          :disabled="loading"
          data-testid="mobile-logout-btn"
          @click="onLogout"
        >{{ loading ? '退出中...' : '退出登录' }}</button>
      </div>
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
// B0341: 移动端抽屉登出入口复用 composable
import { useLogout } from '@/composables/useLogout'

const auth = useAuthStore()
const { handleLogout, loading } = useLogout()
const isMobile = ref(false)
const drawerVisible = ref(false)
function checkMobile() { isMobile.value = window.innerWidth < 768 }
onMounted(() => { checkMobile(); window.addEventListener('resize', checkMobile) })
onUnmounted(() => { window.removeEventListener('resize', checkMobile) })

// B0341: 抽屉内点击登出 → 先登出再关闭抽屉
async function onLogout() {
  await handleLogout()
  drawerVisible.value = false
}

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

/* B0341: 移动端抽屉底部登出入口 */
.app-drawer__footer {
  margin-top: auto;
  padding: var(--space-md);
  border-top: 1px solid var(--color-border);
}
.app-drawer__logout {
  width: 100%;
  padding: 12px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 14px;
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}
.app-drawer__logout:hover:not(:disabled) {
  color: var(--color-error, #dc3545);
  border-color: var(--color-error, #dc3545);
}
.app-drawer__logout:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (min-width: 768px) {
  .app-layout__hamburger {
    display: none;
  }
}
</style>
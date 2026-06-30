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
        <!-- B0341: 全局登出入口（AppHeader 桌面端 + 移动端均可见） -->
        <button
          class="app-header__logout"
          :disabled="loading"
          data-testid="logout-btn"
          @click="handleLogout"
        >{{ loading ? '退出中...' : '退出登录' }}</button>
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
// B0341: 复用 useLogout composable
import { useLogout } from '@/composables/useLogout'

const props = defineProps({ isMobile: { type: Boolean, default: false } })
const auth = useAuthStore()
const { handleLogout, loading } = useLogout()
const navItems = computed(() =>
  NAV_ITEMS.filter(i => !i.requiresAdmin || auth.user?.is_admin)
)
</script>

<!--
  设计稿来源：e046a64 (RR1 zp_manager 初版) views/Dashboard.vue:157-193
  - 56px 高 / sticky top / 玻璃底（var(--color-surface-glass) + blur(20px)）
  - 内容容器 max-width 1200px, padding 0 var(--space-lg)
  - Logo 20px/700；nav 链接 14px 次要色，hover/active 切主色
  - 移动端 (<768px) 隐藏 nav（由 AppLayout 的汉堡按钮接管）
  - z-index 用 var(--z-sticky)，避免与抽屉 / 模态冲突
-->
<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  background: var(--color-surface-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--color-border);
}

.app-header__inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-lg);
  height: 56px;
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}

.app-header__logo {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.app-header__nav {
  display: flex;
  gap: var(--space-md);
  flex: 1;
}

.app-header__nav a {
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 14px;
  transition: color var(--transition-fast);
}

.app-header__nav a:hover,
.app-header__nav a.router-link-active {
  color: var(--text-primary);
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

/* B0341: 桌面端/移动端头部全局登出按钮 */
.app-header__logout {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast);
}
.app-header__logout:hover:not(:disabled) {
  color: var(--color-error, #dc3545);
  border-color: var(--color-error, #dc3545);
}
.app-header__logout:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .app-header__nav {
    display: none;
  }
  /* B0342: 移动端隐藏 AppHeader logout，避免与抽屉底部入口冗余（D1=A） */
  .app-header__logout {
    display: none;
  }
}
</style>

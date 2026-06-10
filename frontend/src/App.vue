<template>
  <div class="app">
    <Toast />
    <router-view />
  </div>

  <!-- 移动端侧边导航 Drawer -->
  <Teleport to="body">
    <div v-if="drawerVisible" class="drawer-overlay" @click="closeDrawer">
      <div class="drawer glass" :class="{ open: drawerVisible }" @click.stop>
        <div class="drawer-header">
          <span class="drawer-logo">Zpersion</span>
          <button class="drawer-close" @click="closeDrawer" aria-label="关闭菜单">×</button>
        </div>
        <nav class="drawer-nav">
          <router-link to="/dashboard" @click="closeDrawer">
            <span class="nav-icon">📊</span>
            <span>仪表盘</span>
          </router-link>
          <router-link to="/plans" @click="closeDrawer">
            <span class="nav-icon">📋</span>
            <span>计划</span>
          </router-link>
          <router-link to="/tasks" @click="closeDrawer">
            <span class="nav-icon">✓</span>
            <span>任务</span>
          </router-link>
          <router-link to="/reports" @click="closeDrawer">
            <span class="nav-icon">📈</span>
            <span>报表</span>
          </router-link>
          <router-link to="/settings" @click="closeDrawer">
            <span class="nav-icon">⚙️</span>
            <span>设置</span>
          </router-link>
          <router-link v-if="authStore.user?.is_admin" to="/admin" @click="closeDrawer">
            <span class="nav-icon">👤</span>
            <span>管理</span>
          </router-link>
        </nav>
        <div class="drawer-footer">
          <div class="user-info">
            <span>{{ authStore.user?.username }}</span>
            <span class="points">{{ authStore.user?.points || 0 }} 积分</span>
          </div>
          <button class="logout-btn" @click="handleLogout">退出</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- 移动端汉堡菜单按钮 -->
  <button
    v-if="isMobile"
    class="hamburger-btn"
    @click="openDrawer"
    aria-label="打开菜单"
  >
    <span class="hamburger-icon">☰</span>
  </button>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import Toast from '@/components/common/Toast.vue'
import '@/styles/variables.css'
import '@/styles/focus-ring.css'
import '@/styles/button-states.css'
import '@/styles/card-hover.css'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const authStore = useAuthStore()
const router = useRouter()
const drawerVisible = ref(false)
const isMobile = ref(false)

// 响应式检测
function checkMobile() {
  isMobile.value = window.innerWidth < 768
}

function openDrawer() {
  drawerVisible.value = true
  document.body.style.overflow = 'hidden'
}

function closeDrawer() {
  drawerVisible.value = false
  document.body.style.overflow = ''
}

async function handleLogout() {
  closeDrawer()
  await authStore.logout()
  router.push('/login')
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
/* 移动端汉堡菜单按钮 */
.hamburger-btn {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-accent);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 113, 227, 0.4);
  cursor: pointer;
  z-index: 998;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
}

.hamburger-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px rgba(0, 113, 227, 0.5);
}

.hamburger-btn:active {
  transform: scale(0.95);
}

.hamburger-icon {
  font-size: 24px;
}

/* Drawer 遮罩 */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  animation: fade-in 0.2s ease;
}

/* Drawer 内容 */
.drawer {
  position: fixed;
  top: 0;
  left: 0;
  width: 280px;
  height: 100vh;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  animation: slide-in 0.3s ease;
  z-index: 1000;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-in {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

/* Drawer 头部 */
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px;
  border-bottom: 1px solid var(--color-border);
}

.drawer-logo {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
}

.drawer-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--color-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
}

.drawer-close:hover {
  background: var(--color-surface);
}

/* Drawer 导航 */
.drawer-nav {
  flex: 1;
  padding: 16px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.drawer-nav a {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  color: var(--color-primary);
  text-decoration: none;
  font-size: 15px;
  transition: background 0.2s;
}

.drawer-nav a:hover {
  background: var(--color-surface);
}

.drawer-nav a.router-link-active {
  background: rgba(0, 113, 227, 0.1);
  color: var(--color-accent);
  border-right: 3px solid var(--color-accent);
}

.nav-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}

/* Drawer 底部 */
.drawer-footer {
  padding: 20px;
  border-top: 1px solid var(--color-border);
}

.drawer-footer .user-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
}

.drawer-footer .user-info span:first-child {
  font-weight: 600;
  font-size: 14px;
}

.drawer-footer .points {
  color: var(--color-accent);
  font-size: 13px;
  font-weight: 500;
}

.logout-btn {
  width: 100%;
  padding: 10px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  color: var(--color-secondary);
  transition: all 0.2s;
}

.logout-btn:hover {
  background: var(--color-surface);
  border-color: var(--color-error);
  color: var(--color-error);
}

/* 桌面端隐藏汉堡按钮 */
@media (min-width: 768px) {
  .hamburger-btn {
    display: none;
  }
}
</style>
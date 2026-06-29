<template>
  <!-- B0300: App.vue 基于 route.meta.layout 动态包裹布局 (方案 A: v-slot + layouts map) -->
  <router-view v-slot="{ Component, route }">
    <component
      :is="layouts[route.meta.layout || 'app']"
      v-bind="route.meta.layout === 'auth' ? { variant: route.meta.layoutVariant } : {}"
      v-if="Component"
    >
      <component :is="Component" />
    </component>
  </router-view>

  <!-- PR0010: 反馈三件套 (挂在 body 内、跨 view 可见) -->
  <CelebrationEffect :trigger="feedback.event" />
  <PointsFloat :trigger="feedback.event" />
  <Toast />
</template>

<script setup>
import { onMounted, onUnmounted, provide } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { storeToRefs } from 'pinia'

// PR0020: CSS 导入顺序 (variables → reset → 其它)
import '@/styles/variables.css'  // 先 token
import '@/styles/reset.css'      // 再 reset
import '@/styles/focus-ring.css'
import '@/styles/button-states.css'
import '@/styles/card-hover.css'
import '@/styles/quill-overrides.css'  // B0251: 暗色模式覆盖 quill
import '@/styles/animations.css'       // B0296: 全局动画

// B0300: 布局 map (key 必须匹配 router meta.layout)
import AppLayout from '@/components/layout/AppLayout.vue'
import AuthLayout from '@/components/layout/AuthLayout.vue'

// B0300 方案 A: layouts map (默认 'app' 兜底)
const layouts = {
  app: AppLayout,
  auth: AuthLayout,
  // error: ErrorLayout, // B0268 后续补充
}

// PR0018: 主题初始化（首次挂载即应用 data-theme）
import { useTheme, provideTheme } from '@/composables/useTheme'
provideTheme()
useTheme()

// PR0010: 反馈总线 provide (跨组件通信)
import { FEEDBACK_KEY, provideFeedback } from '@/composables/useFeedback'
const feedback = provideFeedback()
provide(FEEDBACK_KEY, feedback)

// PR0013: token 过期守卫
import { useTokenExpiry } from '@/composables/useTokenExpiry'
const auth = useAuthStore()
const { token } = storeToRefs(auth)
useTokenExpiry(token)

import { useOnboardingGuide } from '@/composables/useOnboardingGuide'
import Toast from '@/components/common/Toast.vue'
import CelebrationEffect from '@/components/common/CelebrationEffect.vue'
import PointsFloat from '@/components/common/PointsFloat.vue'

// PR0012: 引导在 onMounted 异步启动（等 auth 加载完）
onMounted(async () => {
  try {
    await auth.fetchUser()
  } catch { /* 401 已由拦截器处理 */ }
  const guide = useOnboardingGuide()
  if (guide.shouldShow()) {
    setTimeout(() => guide.startTour(), 1500)
  }
})

// PR0025 / B0033 D1-C: visibilitychange 兜底同步 current_step
// （防 onHighlighted 还没 fire / 用户关 tab / 切窗口时丢最新步）
import { useOnboardingStore } from '@/stores/onboarding'
const onboarding = useOnboardingStore()
function syncOnVisibilityHidden() {
  if (document.visibilityState === 'hidden' && onboarding.active) {
    onboarding.persistCurrentStep(onboarding.activeIndex).catch(() => { /* 静默 */ })
  }
}
document.addEventListener('visibilitychange', syncOnVisibilityHidden)
onUnmounted(() => document.removeEventListener('visibilitychange', syncOnVisibilityHidden))

// v2.18.1: 抽 useOnboardingWatcher 合并两个 watch（登出清 onboarded + restartOnboarding 启动 tour）
import { useOnboardingWatcher } from '@/composables/useOnboardingWatcher'
useOnboardingWatcher()
</script>
<template>
  <!--
    B0300 + 重构：单一外层包裹，居中卡片。
    - variant='default'  → surface 背景（Login/Register/ForgotPassword）
    - variant='gradient' → 紫蓝渐变（ResetPassword）
    - view 自带 <h1> 标题，AuthLayout 不再重复 logo
  -->
  <div class="auth-layout" :class="`auth-layout--${variant}`">
    <div class="auth-layout__card">
      <slot />
    </div>
  </div>
</template>

<script setup>
defineProps({
  variant: { type: String, default: 'default' }, // default | gradient
})
</script>

<!--
  设计稿来源：原 Login/Register/ForgotPassword/ResetPassword 内联卡片样式
  - 卡片：400px max-width、rgba 半透白底 + blur(20px) 玻璃、16px 圆角
  - shell：flex 居中，min-height 100vh，padding 20px
-->
<style scoped>
.auth-layout {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.auth-layout--default {
  background: var(--color-surface);
}

.auth-layout--gradient {
  background: var(--gradient-auth);
}

.auth-layout__card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  border-radius: 16px;
  background: var(--color-surface-glass);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: var(--shadow-lg);
}
</style>

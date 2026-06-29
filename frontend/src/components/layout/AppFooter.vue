<template>
  <footer class="app-footer">
    <span>© 2026 Zpersion · 个人学习管理系统</span>
  </footer>
</template>

<!--
  简单页脚：居中次要色文字 + 顶部分隔线 + 充足内边距。
  设计与 AppHeader 保持一致（border-color / spacing token 同源）。
-->
<style scoped>
.app-footer {
  padding: var(--space-lg);
  border-top: 1px solid var(--color-border-light);
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
}
</style>

// PR0014 阶段 3 — Stylelint 配置
// 强制使用 CSS 变量（var(--*)），禁止硬编码颜色
// baseline 模式 (warn-only) → strict 模式 (exit 1) 切换见 scripts/style-audit.mjs

module.exports = {
  extends: ['stylelint-config-standard'],
  rules: {
    'declaration-property-value-disallowed-list': {
      color: ['/^#[0-9a-fA-F]{3,8}$/', '/^rgb\\(/', '/^hsl\\(/'],
      'background-color': ['/^#[0-9a-fA-F]{3,8}$/', '/^rgb\\(/', '/^hsl\\(/'],
      'border-color': ['/^#[0-9a-fA-F]{3,8}$/', '/^rgb\\(/', '/^hsl\\(/'],
    },
    'selector-class-pattern': null,
    'no-duplicate-selectors': true,
    'declaration-block-no-duplicate-properties': {
      ignore: ['consecutive-duplicates-with-different-values'],
    },
    'custom-property-pattern': null,
    'value-keyword-case': null,
    'media-feature-range-notation': null,
    'declaration-empty-line-before': null,
    'no-descending-specificity': null,
    'comment-empty-line-before': null,
    'rule-empty-line-before': null,
    'at-rule-empty-line-before': null,
    'selector-class-name-pattern': null,
  },
  ignoreFiles: [
    'src/styles/reset.css',
    'node_modules/**',
  ],
}

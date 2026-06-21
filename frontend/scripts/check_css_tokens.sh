#!/usr/bin/env bash
# PR0020 — CSS Token 强制约束 CI 守卫
# 两阶段：
#   - 默认（--baseline）: WARN-only，CI 不阻断，仅打印统计
#   - 严格模式（无 --baseline 或 STYLE_AUDIT_STRICT=1）: 发现即 exit 1
# 用法:
#   scripts/check_css_tokens.sh             # 严格模式（CI 阻断）
#   scripts/check_css_tokens.sh --baseline  # 基线模式（开发期）
#   STYLE_AUDIT_BASELINE=1 scripts/check_css_tokens.sh

set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGETS=("src/views" "src/components")

COLOR_REGEX='#[0-9a-fA-F]{3,8}\b|\brgb\(|\brgba\(|\bhsl\(|\bhsla\('

BASELINE=0
for arg in "$@"; do
  [[ "$arg" == "--baseline" ]] && BASELINE=1
done
[[ "${STYLE_AUDIT_BASELINE:-0}" == "1" ]] && BASELINE=1

TOTAL=0
echo "=== PR0020 CSS Token 守卫 (mode: $([[ $BASELINE -eq 1 ]] && echo baseline || echo strict)) ==="
echo ""

for dir in "${TARGETS[@]}"; do
  full="$ROOT/$dir"
  if [[ ! -d "$full" ]]; then
    echo "[skip] $dir (目录不存在)"
    continue
  fi
  HITS=$(grep -rEn "$COLOR_REGEX" "$full" --include='*.vue' 2>/dev/null \
    | grep -Ev 'var\(--|/\*|//|currentColor|transparent|inherit' \
    || true)
  if [[ -n "$HITS" ]]; then
    COUNT=$(echo "$HITS" | wc -l | tr -d ' ')
    TOTAL=$((TOTAL + COUNT))
    if [[ $BASELINE -eq 1 ]]; then
      echo "[warn] $dir: $COUNT 处硬编码颜色（基线模式不阻断）"
    else
      echo "  ❌ $dir ($COUNT 处):"
      echo "$HITS" | sed 's/^/    /'
    fi
  else
    echo "[ok] $dir: 0 硬编码颜色"
  fi
done

echo ""
if [[ $TOTAL -eq 0 ]]; then
  echo "✅ 0 硬编码颜色"
  exit 0
fi

if [[ $BASELINE -eq 1 ]]; then
  echo "⚠️  共 $TOTAL 处硬编码颜色（基线模式不阻断；切换严格模式: unset STYLE_AUDIT_BASELINE 或去掉 --baseline）"
  exit 0
fi

echo "❌ 失败: $TOTAL 处硬编码颜色，请改用 var(--*) 引用设计令牌"
exit 1

// PR0026 — 拖动卡片到牌堆底时的数组重排纯函数
// 纯函数，可独立单测。

/**
 * 把 order 数组中的 `draggedItem` 移到末尾（其它项保持相对顺序不变）。
 * - 拖动项不在数组中 → 原样返回
 * - 拖动项已在末尾 → 原样返回
 * - 数组只有 1 项 → 原样返回
 *
 * @param {Array} order - 当前顺序（每项唯一，建议用 scheduled_date 字符串）
 * @param {*} draggedItem - 被拖动到牌堆底的那一项
 * @returns {Array} 新顺序数组（不修改入参）
 */
export function reorderStackAfterDrag(order, draggedItem) {
  if (!Array.isArray(order) || order.length === 0) return []
  const idx = order.indexOf(draggedItem)
  if (idx === -1) return [...order]
  if (idx === order.length - 1) return [...order]
  const next = [...order]
  const [item] = next.splice(idx, 1)
  next.push(item)
  return next
}
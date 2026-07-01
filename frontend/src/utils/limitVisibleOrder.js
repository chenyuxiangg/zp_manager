// PR0026 v2 — 限制牌堆最多展示的卡片数量
// 超过 limit 张时，多余的卡片被隐藏；只有在 order 重排（如拖动）后才依次露出。
// 纯函数，便于单测。

/**
 * 返回 order 数组的前 limit 项。limit 默认 5。
 * 不会修改入参。
 *
 * @param {Array} order - 完整顺序数组
 * @param {number} [limit=5] - 最多返回多少项
 * @returns {Array}
 */
export function limitVisibleOrder(order, limit = 5) {
  if (!Array.isArray(order)) return []
  if (typeof limit !== 'number' || limit < 0) return []
  return order.slice(0, limit)
}
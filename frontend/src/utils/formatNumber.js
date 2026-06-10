/**
 * 数字格式化工具
 */

/**
 * 数字溢出格式化 - 大数字转为万/千单位
 * @param {number} num
 * @param {Object} options
 * @returns {string}
 */
export function formatNumber(num, options = {}) {
  const { threshold = 10000, decimals = 1 } = options

  if (typeof num !== 'number') {
    return String(num)
  }

  if (num >= threshold) {
    return (num / 10000).toFixed(decimals) + '万'
  }

  if (num >= 1000) {
    return (num / 1000).toFixed(decimals) + 'k'
  }

  return num.toString()
}

/**
 * 数字补零
 * @param {number} num
 * @param {number} length
 * @returns {string}
 */
export function padZero(num, length = 2) {
  return String(num).padStart(length, '0')
}

/**
 * 格式化百分比
 * @param {number} value
 * @param {number} decimals
 * @returns {string}
 */
export function formatPercent(value, decimals = 0) {
  return `${value.toFixed(decimals)}%`
}

/**
 * 格式化文件大小
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
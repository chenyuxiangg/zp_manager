// B0291/B0292 — 前端 XSS 防御
// 后端已用 bleach sanitize (RR1)，前端再加一道防御性 strip
// 仅允许白名单标签 + 属性，禁止 javascript:/data:/on* 事件

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre', 'blockquote',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'img', 'span', 'div',
])
const ALLOWED_ATTRS = new Set(['href', 'title', 'alt', 'src', 'class', 'target', 'rel'])

// 简单实现：去掉 script/iframe/on* 属性 / javascript: 协议
// 实际项目建议加 dompurify 依赖（~20KB），这里用最简的 regex strip
export function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return ''
  let s = html
  // 1. 移除 <script>...</script>
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  // 2. 移除 <iframe>, <object>, <embed>
  s = s.replace(/<\/?(iframe|object|embed|form|input|style|link|meta)[\s\S]*?>/gi, '')
  // 3. 移除 on* 事件属性
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  // 4. 移除 javascript: / data: 协议
  s = s.replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, '')
  s = s.replace(/(href|src)\s*=\s*("data:(?!image\/)[^"]*"|'data:(?!image\/)[^']*')/gi, '')
  // 5. 移除未白名单标签（保留内容）
  s = s.replace(/<(\/?)([a-z][a-z0-9]*)([^>]*)>/gi, (m, slash, tag, attrs) => {
    if (!ALLOWED_TAGS.has(tag.toLowerCase())) return ''
    // 过滤属性
    const filtered = (attrs.match(/[a-z\-]+\s*=\s*("[^"]*"|'[^']*')/gi) || [])
      .filter(a => {
        const name = a.split('=')[0].trim().toLowerCase()
        return ALLOWED_ATTRS.has(name)
      })
      .join(' ')
    return `<${slash}${tag}${filtered ? ' ' + filtered : ''}>`
  })
  return s
}

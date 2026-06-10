"""
HTML sanitize 工具（D4 决策：XSS 防护）

为避免 XSS 攻击，对所有富文本输入（评论 content、task description 等）做清洗。
- 白名单标签：常用排版标签
- 白名单属性：a 标签的 href/title/target
- 白名单协议：http、https、mailto
- 剥除不在白名单的标签和属性（保留文本内容）
- 剥除 HTML 注释
"""
import bleach

ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 'a',
    'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
    'h1', 'h2', 'h3',
]
ALLOWED_ATTRS = {
    'a': ['href', 'title', 'target'],
}
ALLOWED_PROTOCOLS = ['http', 'https', 'mailto']


def sanitize_html(content):
    """清洗 HTML，返回安全的子集

    Args:
        content: 原始 HTML 字符串

    Returns:
        清洗后的 HTML 字符串。如果 content 为 None 或空字符串，原样返回。
    """
    if not content:
        return content
    return bleach.clean(
        content,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRS,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,           # 不允许的标签被剥除（保留文本）
        strip_comments=True,  # 剥除 HTML 注释
    )


def strip_tags(content):
    """剥除所有 HTML 标签，仅保留纯文本

    用于 title 字段：title 不应包含任何 HTML（即使在白名单内的标签），
    因为前端 title 是用 v-text 渲染而非 v-html，HTML 标签会显示为字面字符。

    Args:
        content: 原始字符串

    Returns:
        仅含纯文本的字符串。如果 content 为 None 或空字符串，原样返回。
    """
    if not content:
        return content
    return bleach.clean(
        content,
        tags=[],
        attributes={},
        strip=True,
    ).strip()

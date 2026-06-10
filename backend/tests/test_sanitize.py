"""
迭代 5: HTML sanitize（bleach 封装）+ 全量接入富文本入口
- utils.sanitize.sanitize_html 单元测试
- add_comment / update_comment / update_task.description 接入验证
"""
import pytest
from utils.sanitize import sanitize_html


# ============ utils 单元测试 ============

class TestSanitizeUnit:
    """utils.sanitize.sanitize_html 工具函数"""

    def test_sanitize_strips_script_tag(self):
        assert '<script>' not in sanitize_html('<script>alert(1)</script>hi')

    def test_sanitize_strips_event_handler_onclick(self):
        out = sanitize_html('<p onclick="hack()">safe</p>')
        assert 'onclick' not in out
        assert '<p>safe</p>' in out

    def test_sanitize_strips_event_handler_onerror(self):
        out = sanitize_html('<img src=x onerror=alert(1)>')
        assert 'onerror' not in out
        assert '<img' not in out  # img 不在白名单

    def test_sanitize_strips_javascript_href(self):
        out = sanitize_html('<a href="javascript:alert(1)">x</a>')
        assert 'javascript:' not in out

    def test_sanitize_allows_safe_p_tag(self):
        assert sanitize_html('<p>hi</p>') == '<p>hi</p>'

    def test_sanitize_allows_strong_em(self):
        assert sanitize_html('<strong>bold</strong><em>italic</em>') == '<strong>bold</strong><em>italic</em>'

    def test_sanitize_allows_safe_href(self):
        out = sanitize_html('<a href="https://example.com">link</a>')
        assert 'href' in out
        assert 'https://example.com' in out

    def test_sanitize_strips_html_comments(self):
        assert '<!--' not in sanitize_html('hi<!--bad-->')

    def test_sanitize_handles_empty_string(self):
        assert sanitize_html('') == ''

    def test_sanitize_handles_none(self):
        assert sanitize_html(None) is None

    def test_sanitize_strips_iframe(self):
        assert 'iframe' not in sanitize_html('<iframe src="x"></iframe>hi').lower()

    def test_sanitize_preserves_lists(self):
        out = sanitize_html('<ul><li>a</li><li>b</li></ul>')
        assert '<ul>' in out
        assert '<li>a</li>' in out


# ============ 接入点集成测试 ============

class TestSanitizeIntegration:
    """富文本入口接入验证"""

    def test_add_comment_sanitizes_script(self, client, auth_headers, task):
        res = client.post(f'/api/tasks/{task.id}/comments',
                          json={'content': '<script>alert(1)</script><p>safe</p>'},
                          headers=auth_headers)
        assert res.status_code == 201
        content = res.get_json()['data']['comment']['content']
        assert '<script>' not in content
        assert '<p>safe</p>' in content

    def test_add_comment_sanitizes_event_handler(self, client, auth_headers, task):
        res = client.post(f'/api/tasks/{task.id}/comments',
                          json={'content': '<p onclick="bad()">click</p>'},
                          headers=auth_headers)
        content = res.get_json()['data']['comment']['content']
        assert 'onclick' not in content
        assert 'click' in content

    def test_update_comment_sanitizes(self, client, auth_headers, task, comment):
        res = client.put(f'/api/tasks/{task.id}/comments/{comment.id}',
                         json={'content': '<script>x</script><p>updated</p>'},
                         headers=auth_headers)
        content = res.get_json()['data']['comment']['content']
        assert '<script>' not in content
        assert '<p>updated</p>' in content

    def test_update_task_description_sanitizes(self, client, auth_headers, task):
        res = client.put(f'/api/tasks/{task.id}',
                         json={'description': '<img src=x onerror=alert(1)><p>safe desc</p>'},
                         headers=auth_headers)
        assert res.status_code == 200
        desc = res.get_json()['data']['task']['description']
        assert 'onerror' not in desc
        assert 'safe desc' in desc

    def test_add_comment_preserves_safe_formatting(self, client, auth_headers, task):
        """白名单标签应保留"""
        res = client.post(f'/api/tasks/{task.id}/comments',
                          json={'content': '<p>Hello <strong>World</strong></p>'},
                          headers=auth_headers)
        content = res.get_json()['data']['comment']['content']
        assert content == '<p>Hello <strong>World</strong></p>'

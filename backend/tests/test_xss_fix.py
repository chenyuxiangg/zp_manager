"""
迭代 6: 修复联调报告遗留 #1 — Task title XSS

联调报告 5.4.4：PUT /api/tasks/:id 接收 title 未 sanitize，
<script> 被存入 MySQL，导致 XSS 风险。

修复策略：使用 bleach 库（已安装）剥离所有 HTML 标签，仅保留纯文本。
同步覆盖 plan.title / stage.title（保持一致性）。
"""
import pytest


class TestTaskTitleXSS:
    """Task title 字段 XSS 防护"""

    def test_update_task_strips_script_from_title(self, client, auth_headers, task):
        res = client.put(f'/api/tasks/{task.id}',
                         json={'title': '<script>alert(1)</script>Hello'},
                         headers=auth_headers)
        assert res.status_code == 200
        # script 标签被剥除，保留文本
        assert '<script>' not in res.get_json()['data']['task']['title']
        assert 'Hello' in res.get_json()['data']['task']['title']

    def test_update_task_strips_all_html_tags_from_title(self, client, auth_headers, task):
        res = client.put(f'/api/tasks/{task.id}',
                         json={'title': '<img src=x onerror=alert(1)><b>Bold</b>'},
                         headers=auth_headers)
        title = res.get_json()['data']['task']['title']
        assert '<img' not in title
        assert '<b>' not in title
        assert 'Bold' in title  # 文本保留

    def test_update_task_preserves_plain_text_title(self, client, auth_headers, task):
        """正常 title 不受影响"""
        res = client.put(f'/api/tasks/{task.id}',
                         json={'title': '正常任务标题 ABC 123'},
                         headers=auth_headers)
        assert res.get_json()['data']['task']['title'] == '正常任务标题 ABC 123'

    def test_update_task_strips_javascript_protocol(self, client, auth_headers, task):
        res = client.put(f'/api/tasks/{task.id}',
                         json={'title': '<a href="javascript:alert(1)">x</a>'},
                         headers=auth_headers)
        title = res.get_json()['data']['task']['title']
        assert 'javascript:' not in title
        assert 'href' not in title

    def test_update_task_empty_title_after_strip_rejected(self, client, auth_headers, task):
        """如果 title 全部是 HTML 标签，清洗后变空字符串 → 拒绝更新（防止误清空）"""
        res = client.put(f'/api/tasks/{task.id}',
                         json={'title': '<script></script>'},
                         headers=auth_headers)
        # 应当返回 422 校验错误
        assert res.status_code == 422
        assert res.get_json()['error']['code'] == 'VALIDATION_ERROR'

    def test_update_task_title_with_only_whitespace_after_strip_rejected(
        self, client, auth_headers, task
    ):
        """清洗后仅空白也拒绝"""
        res = client.put(f'/api/tasks/{task.id}',
                         json={'title': '<p>   </p>'},
                         headers=auth_headers)
        assert res.status_code == 422


class TestPlanTitleXSS:
    """Plan title 字段 XSS 防护（保持一致性）"""

    def test_create_plan_strips_html_from_title(self, client, auth_headers):
        from datetime import date, timedelta
        res = client.post('/api/plans',
                          json={
                              'title': '<script>alert(1)</script>我的计划',
                              'start_date': date.today().isoformat(),
                              'end_date': (date.today() + timedelta(days=30)).isoformat(),
                          },
                          headers=auth_headers)
        assert res.status_code == 201
        title = res.get_json()['data']['plan']['title']
        assert '<script>' not in title
        assert '我的计划' in title

    def test_update_plan_strips_html_from_title(self, client, auth_headers, plan):
        res = client.put(f'/api/plans/{plan.id}',
                         json={'title': '<b>粗体</b>计划'},
                         headers=auth_headers)
        assert res.status_code == 200
        title = res.get_json()['data']['plan']['title']
        assert '<b>' not in title
        assert '粗体' in title
        assert '计划' in title


class TestStageTitleXSS:
    """Stage title 字段 XSS 防护（保持一致性）"""

    def test_update_stage_strips_html_from_title(self, client, auth_headers, stage):
        res = client.put(f'/api/stages/{stage.id}',
                         json={'title': '<img onerror=x><strong>阶段</strong>'},
                         headers=auth_headers)
        assert res.status_code == 200
        title = res.get_json()['data']['stage']['title']
        assert '<img' not in title
        assert '<strong>' not in title
        assert '阶段' in title

    def test_create_task_strips_html_from_title(self, client, auth_headers, stage):
        from datetime import date
        # 阶段时间范围内
        res = client.post(f'/api/stages/{stage.id}/tasks',
                          json={
                              'title': '<script>hack</script>我的任务',
                              'scheduled_date': date.today().isoformat(),
                          },
                          headers=auth_headers)
        assert res.status_code == 201
        title = res.get_json()['data']['task']['title']
        assert '<script>' not in title
        assert '我的任务' in title

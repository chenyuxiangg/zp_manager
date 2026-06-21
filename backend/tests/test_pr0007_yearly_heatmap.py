"""
PR0007 TDD — yearly-heatmap 后端端点

设计（PR0007 §4.1）：
- GET /api/reports/yearly-heatmap?year=YYYY
- 返 [{date: '2026-01-01', count: 3}, ...] 365 天
- 跨用户隔离
"""
import pytest
from datetime import date
from models import Task


def _code(body):
    if 'code' in body:
        return body['code']
    if isinstance(body.get('error'), dict):
        return body['error'].get('code')
    return None


class TestYearlyHeatmap:
    def test_yearly_heatmap_default_year_returns_365_days(
        self, client, auth_headers
    ):
        """默认年份：返 365 天"""
        res = client.get('/api/reports/yearly-heatmap', headers=auth_headers)
        assert res.status_code == 200
        body = res.get_json()['data']
        days = body['days']
        # 平年 365 / 闰年 366
        assert len(days) in (365, 366)

    def test_yearly_heatmap_year_2024_leap_returns_366_days(
        self, client, auth_headers
    ):
        """2024 闰年：366 天"""
        res = client.get('/api/reports/yearly-heatmap?year=2024', headers=auth_headers)
        body = res.get_json()['data']
        days = body['days']
        assert len(days) == 366
        # 2 月 29 应存在
        assert any(d['date'].endswith('-02-29') for d in days)

    def test_yearly_heatmap_count_completed_tasks(
        self, client, auth_headers, user, stage, session
    ):
        """每天 count = 当日完成 task 数"""
        # 3 个 completed task 都标在 2026-03-15
        for _ in range(3):
            session.add(Task(
                user_id=user.id, stage_id=stage.id, title='t',
                scheduled_date=date(2026, 3, 15),
                points=10, status='completed',
            ))
        session.commit()

        res = client.get('/api/reports/yearly-heatmap?year=2026', headers=auth_headers)
        body = res.get_json()['data']['days']
        target = next(d for d in body if d['date'] == '2026-03-15')
        assert target['count'] == 3
        # 其他日期 count=0
        zero_days = [d for d in body if d['count'] == 0]
        assert len(zero_days) >= 360

    def test_yearly_heatmap_ignores_non_completed(
        self, client, auth_headers, user, stage, session
    ):
        """非 completed 的 task 不计入"""
        session.add(Task(
            user_id=user.id, stage_id=stage.id, title='pending',
            scheduled_date=date(2026, 3, 15),
            points=10, status='pending',
        ))
        session.add(Task(
            user_id=user.id, stage_id=stage.id, title='overdue',
            scheduled_date=date(2026, 3, 15),
            points=10, status='overdue',
        ))
        session.commit()

        res = client.get('/api/reports/yearly-heatmap?year=2026', headers=auth_headers)
        body = res.get_json()['data']['days']
        target = next(d for d in body if d['date'] == '2026-03-15')
        assert target['count'] == 0

    def test_yearly_heatmap_cross_user_isolation(
        self, client, auth_headers, user, other_user, stage, session
    ):
        """alice 拉只看到自己的 task"""
        from datetime import datetime
        session.add(Task(
            user_id=user.id, stage_id=stage.id, title='alice',
            scheduled_date=date(2026, 3, 15), points=10,
            status='completed', completed_at=datetime.utcnow(),
        ))
        session.add(Task(
            user_id=other_user.id, stage_id=stage.id, title='bob',
            scheduled_date=date(2026, 3, 15), points=10,
            status='completed', completed_at=datetime.utcnow(),
        ))
        session.commit()

        res = client.get('/api/reports/yearly-heatmap?year=2026', headers=auth_headers)
        body = res.get_json()['data']['days']
        target = next(d for d in body if d['date'] == '2026-03-15')
        assert target['count'] == 1  # 只有 alice 的

    def test_yearly_heatmap_unauthenticated_returns_401(
        self, client
    ):
        res = client.get('/api/reports/yearly-heatmap')
        assert res.status_code == 401

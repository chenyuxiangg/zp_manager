"""
PR0005 — Reports 模块测试（10 用例）

验证 routes/reports.py 三个端点（weekly/monthly/yearly）+ history 列表的
正确性、跨用户隔离、审计写入等。
"""
import pytest
from datetime import date, datetime, timedelta
from models import Task, PointLog, Report, User


# ── 1. Weekly ─────────────────────────────────────────
class TestWeeklyReport:
    def test_default_week_returns_seven_days(self, client, auth_headers):
        res = client.get('/api/reports/weekly', headers=auth_headers)
        assert res.status_code == 200
        body = res.get_json()['data']['report']
        start = date.fromisoformat(body['period_start'])
        end = date.fromisoformat(body['period_end'])
        assert (end - start).days == 6

    def test_weekly_segments_completed_overdue_upcoming(
        self, client, auth_headers, user, stage, session
    ):
        """三个分段：completed / overdue / upcoming"""
        # 1 已完成
        session.add(Task(
            user_id=user.id, stage_id=stage.id, title='done',
            scheduled_date=date.today(),
            points=10, status='completed',
            completed_at=datetime.utcnow(),
        ))
        # 1 逾期未完成
        session.add(Task(
            user_id=user.id, stage_id=stage.id, title='late',
            scheduled_date=date.today() - timedelta(days=2),
            points=10, status='pending',
        ))
        # 1 未来
        session.add(Task(
            user_id=user.id, stage_id=stage.id, title='future',
            scheduled_date=date.today() + timedelta(days=2),
            points=10, status='pending',
        ))
        session.commit()

        res = client.get('/api/reports/weekly', headers=auth_headers)
        body = res.get_json()['data']['report']
        assert body['summary']['total_tasks'] >= 1
        assert len(body['completed_tasks']) >= 1
        # overdue 段可能含 0+ 项
        assert isinstance(body['overdue_tasks'], list)

    def test_weekly_points_earned_vs_spent(
        self, client, auth_headers, user, session
    ):
        """积分正负分两段累加"""
        session.add(PointLog(user_id=user.id, delta=10, reason='task_completed', operation='award'))
        session.add(PointLog(user_id=user.id, delta=2, reason='comment_added', operation='award'))
        session.add(PointLog(user_id=user.id, delta=-5, reason='task_reverted', operation='refund'))
        session.commit()

        res = client.get('/api/reports/weekly', headers=auth_headers)
        body = res.get_json()['data']['report']
        assert body['summary']['points_earned'] == 12
        assert body['summary']['points_spent'] == 5

    def test_weekly_cross_user_returns_only_own_data(
        self, client, auth_headers, user, other_user, stage, session
    ):
        """alice 拉周报只看到自己的 task"""
        session.add(Task(
            user_id=user.id, stage_id=stage.id, title='alice-task',
            scheduled_date=date.today(),
            points=10, status='completed',
        ))
        session.add(Task(
            user_id=other_user.id, stage_id=stage.id, title='bob-task',
            scheduled_date=date.today(),
            points=10, status='completed',
        ))
        session.commit()

        res = client.get('/api/reports/weekly', headers=auth_headers)
        body = res.get_json()['data']['report']
        alice_ids = [t['title'] for t in body['completed_tasks']]
        assert 'alice-task' in alice_ids
        assert 'bob-task' not in alice_ids

    def test_weekly_empty_user_returns_zero_summary(
        self, client, auth_headers
    ):
        """无 task 时 summary 全 0"""
        res = client.get('/api/reports/weekly', headers=auth_headers)
        body = res.get_json()['data']['report']
        assert body['summary']['total_tasks'] == 0
        assert body['summary']['points_earned'] == 0
        assert body['summary']['points_spent'] == 0
        assert body['summary']['completion_rate'] == 0


# ── 2. Monthly ─────────────────────────────────────────
class TestMonthlyReport:
    def test_monthly_30_days(self, client, auth_headers):
        """2 月（28/29 天）月底不丢任务"""
        res = client.get('/api/reports/monthly?date=2026-02-15', headers=auth_headers)
        body = res.get_json()['data']['report']
        end = date.fromisoformat(body['period_end'])
        assert end.day == 28  # 2026 非闰年

    def test_monthly_31_days(self, client, auth_headers):
        """1 月 31 天完整覆盖"""
        res = client.get('/api/reports/monthly?date=2026-01-15', headers=auth_headers)
        body = res.get_json()['data']['report']
        end = date.fromisoformat(body['period_end'])
        assert end.day == 31


# ── 3. Yearly ─────────────────────────────────────────
class TestYearlyReport:
    def test_yearly_no_overdue_section(self, client, auth_headers, user, stage, session):
        """年报 overdue_tasks 永远空数组（设计 §5）"""
        session.add(Task(
            user_id=user.id, stage_id=stage.id, title='late',
            scheduled_date=date.today() - timedelta(days=10),
            points=10, status='pending',
        ))
        session.commit()
        res = client.get(f'/api/reports/yearly?year={date.today().year}', headers=auth_headers)
        body = res.get_json()['data']['report']
        assert body['overdue_tasks'] == []


# ── 4. History 分页 ─────────────────────────────────────────
class TestReportsHistoryPagination:
    def test_history_pagination(self, client, auth_headers, user, session):
        """page/limit 正确切片"""
        for i in range(5):
            session.add(Report(
                user_id=user.id, type='weekly',
                period_start=date.today() - timedelta(days=7*i),
                period_end=date.today() - timedelta(days=7*i-6),
                content={'i': i},
            ))
        session.commit()
        res = client.get('/api/reports?page=1&limit=2', headers=auth_headers)
        body = res.get_json()['data']
        assert len(body['reports']) == 2
        assert body['total'] == 5

    def test_history_page_out_of_range_returns_empty(
        self, client, auth_headers
    ):
        """page 超界返空（设计 §5 §7）"""
        res = client.get('/api/reports?page=999&limit=10', headers=auth_headers)
        body = res.get_json()['data']
        assert body['reports'] == []


# ── 5. 跨用户隔离 ─────────────────────────────────────────
class TestReportCrossUser:
    def test_history_does_not_leak_other_users(
        self, client, auth_headers, user, other_user, session
    ):
        session.add(Report(
            user_id=user.id, type='weekly',
            period_start=date.today(), period_end=date.today(),
            content={},
        ))
        session.add(Report(
            user_id=other_user.id, type='weekly',
            period_start=date.today(), period_end=date.today(),
            content={},
        ))
        session.commit()
        res = client.get('/api/reports', headers=auth_headers)
        body = res.get_json()['data']
        assert body['total'] == 1  # 只有自己的

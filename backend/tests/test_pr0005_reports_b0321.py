"""
B0321 — Reports 9 字段补齐 contract test

后端 weekly/monthly/yearly 必须返回前端 PR0007 Reports.vue 消费的 9 字段：
- prev_completed / prev_points_earned / prev_comments（同比/环比）
- trend_series / heatmap / table（ECharts + 移动端降级表）
- completed / points_earned / comments（顶层 alias，与 summary 平铺）

否则 PeriodCompareCard / TrendLineChart / CompletionHeatmap / MobileFallbackTable 永远不显示。
"""
import pytest
from datetime import date, datetime, timedelta
from models import Task, PointLog


# ── Weekly 字段契约 ─────────────────────────────────────────
class TestWeeklyB0321Fields:
    def test_weekly_returns_prev_period_completed(self, client, auth_headers, user, stage, session):
        """B0321：prev_completed 来自上一周期（前 7 天）"""
        # 修复：放在确定的 prev_period 范围内（今天 - 10 到 today - 8）
        # 避免 today - 7 边界模糊（可能是 current 或 prev period 边界日）
        for i in range(2):
            prev_date = date.today() - timedelta(days=10 + i)  # 10, 11 天前（明确属于 prev 周期）
            session.add(Task(
                user_id=user.id, stage_id=stage.id, title=f'last-week-{i}',
                scheduled_date=prev_date,
                points=10, status='completed',
                completed_at=datetime.combine(prev_date, datetime.min.time()),
            ))
        session.commit()

        res = client.get('/api/reports/weekly', headers=auth_headers)
        body = res.get_json()['data']['report']
        assert 'prev_completed' in body
        assert body['prev_completed'] >= 2

    def test_weekly_returns_trend_series_seven_days(self, client, auth_headers):
        """B0321：trend_series 是 7 条 [{date, completed, points}]"""
        res = client.get('/api/reports/weekly', headers=auth_headers)
        body = res.get_json()['data']['report']
        assert 'trend_series' in body
        assert isinstance(body['trend_series'], list)
        assert len(body['trend_series']) == 7
        for entry in body['trend_series']:
            assert 'date' in entry
            assert 'completed' in entry
            assert 'points' in entry

    def test_weekly_returns_heatmap_seven_days(self, client, auth_headers):
        """B0321：heatmap 是 7 条 [{date, count}]"""
        res = client.get('/api/reports/weekly', headers=auth_headers)
        body = res.get_json()['data']['report']
        assert 'heatmap' in body
        assert isinstance(body['heatmap'], list)
        assert len(body['heatmap']) == 7
        for entry in body['heatmap']:
            assert 'date' in entry
            assert 'count' in entry

    def test_weekly_returns_mobile_table_columns_rows(self, client, auth_headers):
        """B0321：table 字段含 columns + rows（移动端降级）"""
        res = client.get('/api/reports/weekly', headers=auth_headers)
        body = res.get_json()['data']['report']
        assert 'table' in body
        assert isinstance(body['table'], dict)
        assert 'columns' in body['table']
        assert 'rows' in body['table']
        assert isinstance(body['table']['columns'], list)
        assert isinstance(body['table']['rows'], list)

    def test_weekly_top_level_alias_completed_points_comments(self, client, auth_headers):
        """B0321：report.completed / points_earned / comments（顶层 alias，对应 PeriodCompareCard）"""
        res = client.get('/api/reports/weekly', headers=auth_headers)
        body = res.get_json()['data']['report']
        # 顶层应有这些 alias（即使为空也应有 key）
        assert 'completed' in body
        assert 'points_earned' in body
        assert 'comments' in body
        assert isinstance(body['completed'], int)
        assert isinstance(body['points_earned'], int)
        assert isinstance(body['comments'], int)


# ── Monthly / Yearly 字段契约 ─────────────────────────────────────────
class TestMonthlyYearlyB0321Fields:
    def test_monthly_trend_series_full_month(self, client, auth_headers):
        """B0321：monthly trend_series 是当月全部天数（28-31 条）"""
        res = client.get('/api/reports/monthly', headers=auth_headers)
        body = res.get_json()['data']['report']
        assert 'trend_series' in body
        import calendar
        year = date.today().year
        month = date.today().month
        expected_days = calendar.monthrange(year, month)[1]
        assert len(body['trend_series']) == expected_days

    def test_yearly_trend_series_full_year(self, client, auth_headers):
        """B0321：yearly trend_series 是全年 365 或 366 条"""
        res = client.get('/api/reports/yearly', headers=auth_headers)
        body = res.get_json()['data']['report']
        assert 'trend_series' in body
        year = date.today().year
        expected_days = 366 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 365
        assert len(body['trend_series']) == expected_days

    def test_yearly_heatmap_count_366_in_leap_year(self, client, auth_headers):
        """B0321：yearly heatmap 闰年 366 条"""
        res = client.get('/api/reports/yearly', headers=auth_headers, query_string={'year': 2024})
        body = res.get_json()['data']['report']
        assert len(body['heatmap']) == 366


# ── trend_series / heatmap 数据准确性 ─────────────────────────────────────────
class TestTrendSeriesAccuracy:
    def test_trend_series_counts_completed_per_day(self, client, auth_headers, user, stage, session):
        """B0321：trend_series.completed 按 scheduled_date 计数"""
        target = date.today()
        # 今天 2 个完成
        for i in range(2):
            session.add(Task(
                user_id=user.id, stage_id=stage.id, title=f'today-{i}',
                scheduled_date=target, points=10, status='completed',
                completed_at=datetime.utcnow(),
            ))
        # 昨天 1 个完成
        session.add(Task(
            user_id=user.id, stage_id=stage.id, title='yesterday',
            scheduled_date=target - timedelta(days=1), points=10, status='completed',
            completed_at=datetime.utcnow(),
        ))
        session.commit()

        res = client.get('/api/reports/weekly', headers=auth_headers)
        body = res.get_json()['data']['report']
        # 找今天那条 trend entry
        today_entry = next((e for e in body['trend_series'] if e['date'] == target.isoformat()), None)
        assert today_entry is not None
        assert today_entry['completed'] == 2

        yesterday_entry = next((e for e in body['trend_series'] if e['date'] == (target - timedelta(days=1)).isoformat()), None)
        assert yesterday_entry is not None
        assert yesterday_entry['completed'] == 1

    def test_heatmap_matches_completed_count(self, client, auth_headers, user, stage, session):
        """B0321：heatmap.count 与 trend_series.completed 每日一致"""
        target = date.today()
        session.add(Task(
            user_id=user.id, stage_id=stage.id, title='done',
            scheduled_date=target, points=10, status='completed',
            completed_at=datetime.utcnow(),
        ))
        session.commit()

        res = client.get('/api/reports/weekly', headers=auth_headers)
        body = res.get_json()['data']['report']
        today_iso = target.isoformat()
        heatmap_count = next(e['count'] for e in body['heatmap'] if e['date'] == today_iso)
        trend_completed = next(e['completed'] for e in body['trend_series'] if e['date'] == today_iso)
        assert heatmap_count == trend_completed == 1


# ── prev_period 准确性 ─────────────────────────────────────────
class TestPrevPeriodAccuracy:
    def test_prev_completed_isolated_from_current(self, client, auth_headers, user, stage, session):
        """B0321：prev_completed 仅统计上一周期任务，不应混入当前周期"""
        target = date.today()
        last_week = target - timedelta(days=7)
        # 当前周完成 3 个
        for i in range(3):
            session.add(Task(
                user_id=user.id, stage_id=stage.id, title=f'this-week-{i}',
                scheduled_date=target, points=10, status='completed',
                completed_at=datetime.utcnow(),
            ))
        # 上一周完成 1 个
        session.add(Task(
            user_id=user.id, stage_id=stage.id, title='last-week-0',
            scheduled_date=last_week, points=10, status='completed',
            completed_at=datetime.combine(last_week, datetime.min.time()),
        ))
        session.commit()

        res = client.get('/api/reports/weekly', headers=auth_headers)
        body = res.get_json()['data']['report']
        # 当前 completed alias 是本周 3 个
        assert body['completed'] == 3
        # prev_completed 是上周 1 个
        assert body['prev_completed'] == 1
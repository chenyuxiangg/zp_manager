"""
PR0006 TDD — Streak 服务化

设计（PR0006 §1-3）：
- streak_logs 表：user_id, log_date, completed_count, prev_streak, new_streak, broken
- StreakService.current(user) / longest(user) / days_to_next_milestone
- StreakService.record_completion(user_id, today) 累加当日完成数
- settle_today(user, today) 每日结算
- GET /api/users/streak 返 {current, longest, days_to_7, last_broken_at}
"""
import pytest
from datetime import date, timedelta
from models import StreakLog, User, Task
from services.streak import StreakService


def _code(body):
    if 'code' in body:
        return body['code']
    if isinstance(body.get('error'), dict):
        return body['error'].get('code')
    return None


@pytest.fixture
def make_task_done(user, stage, session):
    """工厂：构造一个指定日期的 completed task"""
    def _make(d: date):
        from datetime import datetime
        t = Task(
            user_id=user.id, stage_id=stage.id, title='t',
            scheduled_date=d, points=10, status='completed',
            completed_at=datetime.combine(d, datetime.min.time()),
        )
        session.add(t); session.commit()
        return t
    return _make


# ── 1. record_completion 幂等累加 ─────────────────────────────────────────
class TestRecordCompletion:
    def test_first_completion_today_sets_count_1(
        self, user, session
    ):
        today = date(2026, 6, 15)
        StreakService.record_completion(user.id, today)
        log = session.query(StreakLog).filter_by(
            user_id=user.id, log_date=today,
        ).first()
        assert log is not None
        assert log.completed_count == 1
        assert log.new_streak == 1

    def test_repeated_completion_same_day_upserts(
        self, user, session
    ):
        """B0191：同日多次累加（幂等）"""
        today = date(2026, 6, 15)
        for _ in range(3):
            StreakService.record_completion(user.id, today)
        log = session.query(StreakLog).filter_by(
            user_id=user.id, log_date=today,
        ).first()
        # B0191 防双调：attempt_count 上限 2
        assert log.completed_count == 2  # sync + outbox 两次

    def test_different_users_isolated(self, user, other_user, session):
        today = date(2026, 6, 15)
        StreakService.record_completion(user.id, today)
        StreakService.record_completion(other_user.id, today)
        # 两个用户各自有独立 log
        logs = session.query(StreakLog).filter_by(log_date=today).all()
        assert len(logs) == 2


# ── 2. settle_today 连续天数结算 ─────────────────────────────────────────
class TestSettleToday:
    def test_settle_continuous_3_days_gives_streak_3(
        self, user, session
    ):
        """连续 3 天每日完成 → streak=3"""
        for i in range(3):
            d = date(2026, 6, 10) + timedelta(days=i)
            # 前 3 天各完成 1 个
            StreakService.record_completion(user.id, d)
            # 每天结算前一天
            settle_date = d + timedelta(days=1)
            StreakService.settle_today(user, settle_date)

        # 6/13 的 streak log
        log = session.query(StreakLog).filter_by(
            user_id=user.id, log_date=date(2026, 6, 13),
        ).first()
        assert log is not None
        assert log.new_streak == 3
        assert log.broken is False

    def test_settle_break_makes_streak_zero(
        self, user, session
    ):
        """5 天中第 3 天断 → 当日 streak 归 0，broken=True"""
        # 6/10 完成
        StreakService.record_completion(user.id, date(2026, 6, 10))
        StreakService.settle_today(user, date(2026, 6, 11))
        # 6/11 完成
        StreakService.record_completion(user.id, date(2026, 6, 11))
        StreakService.settle_today(user, date(2026, 6, 12))
        # 6/12 没完成
        StreakService.settle_today(user, date(2026, 6, 13))
        # 6/13 没完成
        log = session.query(StreakLog).filter_by(
            user_id=user.id, log_date=date(2026, 6, 13),
        ).first()
        assert log.new_streak == 0
        assert log.broken is True


# ── 3. 查询 API ─────────────────────────────────────────
class TestStreakQueries:
    def test_current_returns_latest_new_streak(
        self, user, session
    ):
        StreakService.record_completion(user.id, date(2026, 6, 10))
        StreakService.settle_today(user, date(2026, 6, 11))
        # current 应是 6/11 的 new_streak
        assert StreakService.current(user) == 1

    def test_longest_returns_max(self, user, session):
        # 构造多段历史：6/10 streak=1, 6/11 streak=2, 6/12 broken=0
        StreakService.record_completion(user.id, date(2026, 6, 10))
        StreakService.settle_today(user, date(2026, 6, 11))
        StreakService.record_completion(user.id, date(2026, 6, 11))
        StreakService.settle_today(user, date(2026, 6, 12))
        StreakService.settle_today(user, date(2026, 6, 13))
        assert StreakService.longest(user) == 2

    def test_days_to_7_returns_gap(self, user, session):
        # current=3 → days_to_7=4
        StreakService.record_completion(user.id, date(2026, 6, 10))
        StreakService.settle_today(user, date(2026, 6, 11))
        StreakService.record_completion(user.id, date(2026, 6, 11))
        StreakService.settle_today(user, date(2026, 6, 12))
        StreakService.record_completion(user.id, date(2026, 6, 12))
        StreakService.settle_today(user, date(2026, 6, 13))
        assert StreakService.days_to_next_milestone(user, 7) == 4


# ── 4. 路由 /api/users/streak ─────────────────────────────────────────
class TestStreakRoute:
    def test_route_returns_correct_shape(
        self, client, auth_headers, user, session
    ):
        StreakService.record_completion(user.id, date(2026, 6, 10))
        StreakService.settle_today(user, date(2026, 6, 11))
        res = client.get('/api/users/streak', headers=auth_headers)
        assert res.status_code == 200
        body = res.get_json()['data']
        assert 'current' in body
        assert 'longest' in body
        assert 'days_to_7' in body
        # B0328-fix: 补 days_to_30/days_to_100 字段契约断言
        assert 'days_to_30' in body
        assert 'days_to_100' in body
        assert 'last_broken_at' in body

    def test_route_unauthenticated_returns_401(self, client):
        res = client.get('/api/users/streak')
        assert res.status_code == 401

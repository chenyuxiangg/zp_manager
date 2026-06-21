"""
PR0003 TDD 步骤 1（RED）：rate_guard 反刷分窗口测试

设计目标（PR0003 §2/§5）：
- 同一 task 30 分钟内多次 toggle 仅首次成功
- 第二次起返 409 RATE_LIMITED + retry_after_seconds
- 白名单 source（'pomodoro_auto_toggle'）不被拦截

测试策略：注入 fake `now` 参数（避免 freezegun 与 in-memory SQLite 冲突）。
"""
import math
import pytest
from datetime import datetime, timedelta, date as date_type
from services.rate_guard import RateGuard, WINDOW_SECONDS
from models import Task, PointLog


@pytest.fixture
def fresh_task_setup(user, plan, stage, session):
    from datetime import date
    t = Task(
        user_id=user.id,
        stage_id=stage.id,
        title='rate-guard-task',
        scheduled_date=date.today(),
        points=10,
        status='pending',
    )
    session.add(t)
    session.commit()
    return t


# ── 1. 基础拦截 ─────────────────────────────────────────
class TestRateGuardToggle:
    def test_first_toggle_is_allowed(self, user, fresh_task_setup):
        ok, retry = RateGuard.can_toggle(user.id, fresh_task_setup.id)
        assert ok is True
        assert retry == 0

    def test_within_30_min_blocked(self, user, fresh_task_setup, session):
        """award 后 0 秒：应该被拦，retry_after ≈ 1800"""
        t0 = datetime(2026, 6, 15, 12, 0, 0)
        log = PointLog(
            user_id=user.id, task_id=fresh_task_setup.id,
            delta=10, reason='task_completed', operation='award',
            created_at=t0,
        )
        session.add(log); session.commit()

        ok, retry = RateGuard.can_toggle(user.id, fresh_task_setup.id, now=t0)
        assert ok is False
        assert 1700 < retry <= 1800

    def test_after_30_min_allowed(self, user, fresh_task_setup, session):
        t0 = datetime(2026, 6, 15, 12, 0, 0)
        log = PointLog(
            user_id=user.id, task_id=fresh_task_setup.id,
            delta=10, reason='task_completed', operation='award',
            created_at=t0,
        )
        session.add(log); session.commit()

        # 31 分钟后
        t1 = t0 + timedelta(minutes=31)
        ok, retry = RateGuard.can_toggle(user.id, fresh_task_setup.id, now=t1)
        assert ok is True
        assert retry == 0

    def test_at_exactly_30_min_allowed(self, user, fresh_task_setup, session):
        """恰好 30 分钟边界：应允许（>= 30min 放行）"""
        t0 = datetime(2026, 6, 15, 12, 0, 0)
        log = PointLog(
            user_id=user.id, task_id=fresh_task_setup.id,
            delta=10, reason='task_completed', operation='award',
            created_at=t0,
        )
        session.add(log); session.commit()

        t_edge = t0 + timedelta(seconds=1800)
        ok, retry = RateGuard.can_toggle(user.id, fresh_task_setup.id, now=t_edge)
        assert ok is True

    def test_refund_breaks_window(self, user, fresh_task_setup, session):
        """撤销后 5 分钟：can_toggle 应允许（无未撤销 award）"""
        t0 = datetime(2026, 6, 15, 12, 0, 0)
        session.add(PointLog(
            user_id=user.id, task_id=fresh_task_setup.id,
            delta=10, reason='task_completed', operation='award',
            created_at=t0,
        ))
        session.add(PointLog(
            user_id=user.id, task_id=fresh_task_setup.id,
            delta=-10, reason='task_reverted', operation='refund',
            created_at=t0,
        ))
        session.commit()

        t1 = t0 + timedelta(minutes=5)
        ok, retry = RateGuard.can_toggle(user.id, fresh_task_setup.id, now=t1)
        assert ok is True
        assert retry == 0

    def test_retry_after_is_math_ceil(self, user, fresh_task_setup, session):
        """B0165: retry_after 用 math.ceil"""
        t0 = datetime(2026, 6, 15, 12, 0, 0)
        log = PointLog(
            user_id=user.id, task_id=fresh_task_setup.id,
            delta=10, reason='task_completed', operation='award',
            created_at=t0,
        )
        session.add(log); session.commit()

        t1 = t0 + timedelta(seconds=1)
        ok, retry = RateGuard.can_toggle(user.id, fresh_task_setup.id, now=t1)
        assert ok is False
        assert retry == 1799


# ── 2. source 白名单 ─────────────────────────────────────────
class TestRateGuardWhitelist:
    def test_pomodoro_source_always_allowed(self, user, fresh_task_setup, session):
        t0 = datetime(2026, 6, 15, 12, 0, 0)
        log = PointLog(
            user_id=user.id, task_id=fresh_task_setup.id,
            delta=10, reason='pomodoro_auto_toggle', operation='award',
            created_at=t0,
        )
        session.add(log); session.commit()

        ok, retry = RateGuard.can_toggle(
            user.id, fresh_task_setup.id, now=t0, source='pomodoro_auto_toggle'
        )
        assert ok is True
        assert retry == 0

    def test_manual_source_blocked(self, user, fresh_task_setup, session):
        """manual source 在 30 分钟内被拦（与白名单对照）"""
        t0 = datetime(2026, 6, 15, 12, 0, 0)
        log = PointLog(
            user_id=user.id, task_id=fresh_task_setup.id,
            delta=10, reason='task_completed', operation='award',
            created_at=t0,
        )
        session.add(log); session.commit()

        ok, retry = RateGuard.can_toggle(
            user.id, fresh_task_setup.id, now=t0, source='manual'
        )
        assert ok is False


# ── 3. 隔离性 ─────────────────────────────────────────
class TestRateGuardIsolation:
    def test_different_tasks_isolated(self, user, plan, stage, session):
        t0 = datetime(2026, 6, 15, 12, 0, 0)
        task_a = Task(user_id=user.id, stage_id=stage.id, title='A',
                      scheduled_date=date_type.today(),
                      points=10, status='pending')
        task_b = Task(user_id=user.id, stage_id=stage.id, title='B',
                      scheduled_date=date_type.today(),
                      points=10, status='pending')
        session.add_all([task_a, task_b]); session.commit()

        session.add(PointLog(
            user_id=user.id, task_id=task_a.id,
            delta=10, reason='task_completed', operation='award',
            created_at=t0,
        ))
        session.commit()

        ok_a, _ = RateGuard.can_toggle(user.id, task_a.id, now=t0)
        ok_b, _ = RateGuard.can_toggle(user.id, task_b.id, now=t0)
        assert ok_a is False
        assert ok_b is True

    def test_different_users_isolated(self, user, other_user, fresh_task_setup, session):
        t0 = datetime(2026, 6, 15, 12, 0, 0)
        session.add(PointLog(
            user_id=user.id, task_id=fresh_task_setup.id,
            delta=10, reason='task_completed', operation='award',
            created_at=t0,
        ))
        session.commit()

        ok_self, _ = RateGuard.can_toggle(user.id, fresh_task_setup.id, now=t0)
        ok_other, _ = RateGuard.can_toggle(other_user.id, fresh_task_setup.id, now=t0)
        assert ok_self is False
        assert ok_other is True


# ── 4. 路由层集成 ─────────────────────────────────────────
class TestToggleRouteRateLimit:
    def test_toggle_within_window_returns_409_RATELIMITED(
        self, client, auth_headers, user, fresh_task_setup, session
    ):
        """集成：toggle 路由在窗口内返 409 RATE_LIMITED"""
        # 预置 award log 的 created_at = utcnow()（30 分钟窗口内）
        session.add(PointLog(
            user_id=user.id, task_id=fresh_task_setup.id,
            delta=10, reason='task_completed', operation='award',
            created_at=datetime.utcnow(),
        ))
        session.commit()

        # 由于 toggle route 内部用 datetime.utcnow()，与测试 t0 可能偏差几秒
        # 但因为 30 分钟窗口，余量足够
        res = client.patch(
            f'/api/tasks/{fresh_task_setup.id}/toggle',
            headers=auth_headers,
        )
        assert res.status_code == 409
        body = res.get_json()
        assert body['error']['code'] == 'RATE_LIMITED'
        assert 'retry_after_seconds' in body
        assert body['retry_after_seconds'] > 0

    def test_toggle_first_time_passes(self, client, auth_headers, user, fresh_task_setup, session):
        """首次 toggle 通过（无 award log）"""
        res = client.patch(
            f'/api/tasks/{fresh_task_setup.id}/toggle',
            headers=auth_headers,
        )
        assert res.status_code == 200
        assert res.get_json()['data']['points_delta'] == 10

    # ── B0332：补 toggle 撤销方向 + 连续 toggle + 白名单端到端覆盖 ──

    def test_toggle_revert_within_window_returns_409(
        self, client, auth_headers, user, fresh_task_setup, session
    ):
        """B0331+§6：toggle 撤销（completed→pending）在 30 分钟窗口内返 409

        流程：
        1. toggle 1 次（pending→completed, award +10）
        2. toggle 撤销（completed→pending）——应被 rate_guard 拦截
        """
        # 步骤 1：完成
        res1 = client.patch(
            f'/api/tasks/{fresh_task_setup.id}/toggle',
            headers=auth_headers,
        )
        assert res1.status_code == 200
        assert res1.get_json()['data']['task']['status'] == 'completed'

        # 步骤 2：撤销应被 rate_guard 拦截（B0331 修复后行为）
        res2 = client.patch(
            f'/api/tasks/{fresh_task_setup.id}/toggle',
            headers=auth_headers,
        )
        assert res2.status_code == 409, \
            f'期望撤销被 409 RATE_LIMITED，实际 {res2.status_code} {res2.get_json()}'
        body = res2.get_json()
        assert body['error']['code'] == 'RATE_LIMITED'
        assert body['retry_after_seconds'] > 0

    def test_toggle_completed_uncomplete_complete_within_window_returns_409(
        self, client, auth_headers, user, fresh_task_setup, session
    ):
        """B0331 §6 端到端：complete → 等 1min → toggle 撤销 → 立刻再 toggle 完成 → 期望 409

        集成测试 PR0003 §6 设计的核心攻击场景：
        1. 第一次 toggle 完成（award +10）
        2. 第二次 toggle 撤销（应 409，rate_guard 拦截）
        3. 第三次 toggle 完成（也应 409，rate_guard 仍拦）
        """
        # 第 1 次：pending → completed
        res1 = client.patch(
            f'/api/tasks/{fresh_task_setup.id}/toggle',
            headers=auth_headers,
        )
        assert res1.status_code == 200

        # 第 2 次：撤销尝试 → 409
        res2 = client.patch(
            f'/api/tasks/{fresh_task_setup.id}/toggle',
            headers=auth_headers,
        )
        assert res2.status_code == 409
        assert res2.get_json()['error']['code'] == 'RATE_LIMITED'

        # 第 3 次：再完成尝试 → 仍 409（30min 窗口未过）
        res3 = client.patch(
            f'/api/tasks/{fresh_task_setup.id}/toggle',
            headers=auth_headers,
        )
        assert res3.status_code == 409, \
            f'期望继续被 409 RATE_LIMITED，实际 {res3.status_code} {res3.get_json()}'

        # 验证：只写入了 1 条 award log（无 refund log，因为撤销被拦）
        award_count = session.query(PointLog).filter_by(
            user_id=user.id, task_id=fresh_task_setup.id, operation='award'
        ).count()
        refund_count = session.query(PointLog).filter_by(
            user_id=user.id, task_id=fresh_task_setup.id, operation='refund'
        ).count()
        assert award_count == 1, f'应仅 1 条 award log，实际 {award_count}'
        assert refund_count == 0, f'应 0 条 refund log（撤销被拦），实际 {refund_count}'

    def test_pomodoro_whitelist_bypasses_30min_window(
        self, client, auth_headers, user, fresh_task_setup, session
    ):
        """B0332：pomodoro_auto_toggle 白名单放行

        流程：
        1. 第一次手动 toggle 完成（award +10）
        2. pomodoro_auto_toggle 源 toggle 应绕过 30min 窗口（白名单）
        """
        # 步骤 1：手动完成
        res1 = client.patch(
            f'/api/tasks/{fresh_task_setup.id}/toggle',
            headers=auth_headers,
        )
        assert res1.status_code == 200

        # 步骤 2：pomodoro_auto_toggle 源 toggle（白名单放行）
        # 但任务已完成，所以这次会走撤销分支（refund -10）
        # PR0003 §白名单设计：pomodoro_auto_toggle 跳过 rate_guard，
        # 即使任务已完成，也允许 pomodoro 路径的 toggle 调用
        res2 = client.patch(
            f'/api/tasks/{fresh_task_setup.id}/toggle',
            headers=auth_headers,
            json={'source': 'pomodoro_auto_toggle'},
        )
        # 白名单放行 rate_guard，但 toggle 内部 if-else 仍按 task.status 走撤销
        assert res2.status_code == 200
        assert res2.get_json()['data']['points_delta'] == -10
        assert res2.get_json()['data']['task']['status'] == 'pending'

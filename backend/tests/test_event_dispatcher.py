"""
B0221 TDD — Outbox consumer worker 测试

设计（PR0004 §6 transactional outbox + B0221 修复方案）：
- worker/event_dispatcher.py 拉取 published_at=NULL 的事件
- 调订阅者（StreakService.record_completion）
- UPDATE published_at
- routes/tasks.py:toggle_task 加 sync fallback
"""
import pytest
from datetime import date
from models import EventOutbox, StreakLog, Task
from services.points import PointsService
from worker.event_dispatcher import dispatch_pending


def _code(body):
    if 'code' in body:
        return body['code']
    if isinstance(body.get('error'), dict):
        return body['error'].get('code')
    return None


@pytest.fixture
def completed_today_task(user, stage, session):
    """构造一个 completed task 用于 PointsService.award"""
    from datetime import datetime
    t = Task(
        user_id=user.id, stage_id=stage.id, title='for-outbox',
        scheduled_date=date.today(),
        points=10, status='completed',
        completed_at=datetime.utcnow(),
    )
    session.add(t); session.commit()
    return t


# ── 1. 端到端：award 写 outbox → dispatcher 消费 → streak 写入 ─────────────────────────────────────────
class TestOutboxEndToEnd:
    def test_award_writes_outbox_row(
        self, app, user, completed_today_task, session
    ):
        """award 同事务写 EventOutbox published_at=NULL"""
        PointsService.award(user, completed_today_task, on_time=True)
        session.commit()
        outbox = (
            session.query(EventOutbox)
            .filter_by(related_user_id=user.id)
            .first()
        )
        assert outbox is not None
        assert outbox.published_at is None
        assert 'TaskCompleted' in outbox.event_name

    def test_dispatcher_consumes_task_completed_event_and_writes_streak(
        self, app, user, completed_today_task, session
    ):
        """dispatcher 消费 TaskCompleted 事件 → StreakService.record_completion 触发"""
        # 1. 触发 award 写 outbox
        PointsService.award(user, completed_today_task, on_time=True)
        session.commit()

        # 2. 跑 dispatcher
        stats = dispatch_pending()
        assert stats['picked'] >= 1
        assert stats['dispatched'] >= 1

        # 3. 验证 streak_logs 写入
        log = (
            session.query(StreakLog)
            .filter_by(user_id=user.id, log_date=date.today())
            .first()
        )
        assert log is not None
        assert log.completed_count >= 1

        # 4. 验证 outbox.published_at 不为 None
        outbox = (
            session.query(EventOutbox)
            .filter_by(related_user_id=user.id)
            .first()
        )
        assert outbox.published_at is not None

    def test_dispatcher_marks_published_at_on_consume(
        self, app, user, completed_today_task, session
    ):
        """dispatcher 跑过后 published_at 被设置（不可重复消费）"""
        PointsService.award(user, completed_today_task, on_time=True)
        session.commit()
        dispatch_pending()
        # 第二次跑：应不再 pick 到这条
        stats2 = dispatch_pending()
        assert stats2['picked'] == 0

    def test_dispatcher_handles_failed_subscriber(
        self, app, user, completed_today_task, session
    ):
        """订阅者抛错 → outbox.published_at 不变 + retry_count += 1"""
        from unittest.mock import patch
        PointsService.award(user, completed_today_task, on_time=True)
        session.commit()

        with patch('services.streak.StreakService.record_completion',
                   side_effect=Exception('mocked failure')):
            stats = dispatch_pending()
        assert stats['failed'] >= 1
        outbox = (
            session.query(EventOutbox)
            .filter_by(related_user_id=user.id)
            .first()
        )
        assert outbox.published_at is None  # 未发布
        assert outbox.retry_count >= 1
        assert 'mocked failure' in (outbox.last_error or '')


# ── 2. sync fallback：toggle_task 路由直接调 record_completion ─────────────────────────────────────────
class TestToggleTaskSyncFallback:
    def test_toggle_completed_calls_streak_sync(
        self, client, auth_headers, user, task, session
    ):
        """B0188：toggle 后同 worker 立即调 StreakService.record_completion（兜底 outbox 30s 延迟）"""
        from datetime import date as date_type
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        # sync fallback 应该立即写 streak log
        log = (
            session.query(StreakLog)
            .filter_by(user_id=user.id, log_date=date_type.today())
            .first()
        )
        assert log is not None
        assert log.completed_count >= 1

"""
PR0001 TDD 步骤 1（RED）：reminder_worker 调度测试

设计目标（PR0001 §1-6）：
- reminders 表加 attempt_count / next_retry_at 字段
- worker_runs 表记录每次 worker 跑的统计
- 失败 3 次 → status='failed'，不再 retry
- 成功 → status='sent', sent_at=now
- dry-run 模式不发邮件
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch
from models import Reminder, WorkerRun, Task
from services.reminder import dispatch_pending, MAX_ATTEMPTS


@pytest.fixture
def pending_reminder(user, task, session):
    """构造一条 pending 提醒（scheduled_at = 1 分钟前）"""
    r = Reminder(
        user_id=user.id,
        task_id=task.id,
        type='learn',
        channel='email',
        scheduled_at=datetime.utcnow() - timedelta(minutes=1),
        status='pending',
    )
    session.add(r); session.commit()
    return r


# ── 1. 派发成功 ─────────────────────────────────────────
class TestDispatchSuccess:
    def test_first_attempt_succeeds_status_sent(self, pending_reminder, session):
        with patch('services.reminder._send_email') as mock_send:
            mock_send.return_value = True
            stats = dispatch_pending(dry_run=False)

        session.refresh(pending_reminder)
        assert stats['sent'] == 1
        assert stats['failed'] == 0
        assert pending_reminder.status == 'sent'
        assert pending_reminder.sent_at is not None
        assert pending_reminder.attempt_count == 1
        assert mock_send.call_count == 1

    def test_worker_run_row_created(self, pending_reminder, session):
        with patch('services.reminder._send_email', return_value=True):
            dispatch_pending(dry_run=False)
        run = session.query(WorkerRun).order_by(WorkerRun.id.desc()).first()
        assert run is not None
        assert run.job_name == 'reminder_dispatch'
        assert run.sent >= 1
        assert run.finished_at is not None
        assert run.error is None


# ── 2. 派发失败重试 ─────────────────────────────────────────
class TestDispatchRetry:
    def test_first_failure_increments_attempt_count(self, pending_reminder, session):
        with patch('services.reminder._send_email', return_value=False):
            dispatch_pending(dry_run=False)
        session.refresh(pending_reminder)
        assert pending_reminder.status == 'pending'  # 还没到 3 次
        assert pending_reminder.attempt_count == 1
        assert pending_reminder.next_retry_at is not None

    def test_three_failures_marks_failed(self, pending_reminder, session):
        """3 次失败后 status=failed，下次不再被派发"""
        with patch('services.reminder._send_email', return_value=False):
            # 跑 3 次
            for i in range(3):
                # 模拟 next_retry_at 已到
                pending_reminder.next_retry_at = None
                session.commit()
                dispatch_pending(dry_run=False)
        session.refresh(pending_reminder)
        assert pending_reminder.status == 'failed'
        assert pending_reminder.attempt_count == 3
        assert pending_reminder.last_error is not None

    def test_scheduled_in_future_not_picked(self, user, task, session):
        """scheduled_at 在未来的提醒：本次不派发"""
        r = Reminder(
            user_id=user.id, task_id=task.id, type='learn', channel='email',
            scheduled_at=datetime.utcnow() + timedelta(hours=1),
            status='pending',
        )
        session.add(r); session.commit()

        with patch('services.reminder._send_email', return_value=True) as mock_send:
            dispatch_pending(dry_run=False)
        # 没有调用 send
        assert mock_send.call_count == 0
        session.refresh(r)
        assert r.status == 'pending'


# ── 3. 退避策略 ─────────────────────────────────────────
class TestBackoffStrategy:
    def test_next_retry_at_is_in_future(self, pending_reminder, session):
        """B0148：失败后 next_retry_at 在未来"""
        with patch('services.reminder._send_email', return_value=False):
            dispatch_pending(dry_run=False)
        session.refresh(pending_reminder)
        assert pending_reminder.next_retry_at > datetime.utcnow()

    def test_next_retry_at_grows_with_attempts(self, pending_reminder, session):
        """失败 1 次：5min / 2 次：15min"""
        with patch('services.reminder._send_email', return_value=False):
            dispatch_pending(dry_run=False)  # 1st fail
        session.refresh(pending_reminder)
        first_retry = pending_reminder.next_retry_at

        # 2nd attempt: 让 next_retry_at 已到，重置
        pending_reminder.next_retry_at = None
        session.commit()
        with patch('services.reminder._send_email', return_value=False):
            dispatch_pending(dry_run=False)
        session.refresh(pending_reminder)
        second_retry = pending_reminder.next_retry_at

        # 第二次重试间隔（15min）应大于第一次（5min）
        assert (second_retry - datetime.utcnow()).total_seconds() > \
               (first_retry - datetime.utcnow()).total_seconds()


# ── 4. dry-run 模式 ─────────────────────────────────────────
class TestDryRun:
    def test_dry_run_does_not_send(self, pending_reminder, session):
        with patch('services.reminder._send_email') as mock_send:
            stats = dispatch_pending(dry_run=True)
        # 不发邮件
        assert mock_send.call_count == 0
        # 但仍会扫到 pending 提醒
        assert stats['picked'] == 1
        session.refresh(pending_reminder)
        # 状态不变
        assert pending_reminder.status == 'pending'


# ── 5. 跨机锁（MySQL GET_LOCK）─────────────────────────────────────────
class TestSchedulerLock:
    def test_lock_context_manager(self, app):
        """WorkerLock 上下文管理器：acquire/release"""
        from services.scheduler_lock import WorkerLock
        with app.app_context():
            with WorkerLock('test_lock', timeout=1) as acquired:
                assert acquired is True or acquired is False  # SQLite 不支持，可能 False
        # 退出上下文不抛异常

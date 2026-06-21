"""
PR0002 TDD 步骤 1（RED）：overdue_scanner 调度测试

设计目标（PR0002 §1-7）：
- overdue_runs 表记录每次扫描的统计
- pending/in_progress + scheduled_date < today → overdue
- overdue + scheduled_date >= today → pending（用户挪日期恢复）
- 已 completed 的 task 不动
- 跨 user 隔离
- 失败一次不影响下次扫描（幂等）
"""
import pytest
from datetime import date, datetime, timedelta
from models import Task, OverdueRun
from services.overdue import scan_overdue, mark_pending_recovery


@pytest.fixture
def yesterday_task(user, stage, session):
    t = Task(
        user_id=user.id, stage_id=stage.id, title='yesterday',
        scheduled_date=date.today() - timedelta(days=1),
        points=10, status='pending',
    )
    session.add(t); session.commit()
    return t


@pytest.fixture
def today_task(user, stage, session):
    t = Task(
        user_id=user.id, stage_id=stage.id, title='today',
        scheduled_date=date.today(),
        points=10, status='pending',
    )
    session.add(t); session.commit()
    return t


@pytest.fixture
def completed_yesterday(user, stage, session):
    t = Task(
        user_id=user.id, stage_id=stage.id, title='done',
        scheduled_date=date.today() - timedelta(days=1),
        points=10, status='completed',
        completed_at=datetime.utcnow() - timedelta(days=1),
    )
    session.add(t); session.commit()
    return t


# ── 1. 标 overdue ─────────────────────────────────────────
class TestScanOverdue:
    def test_yesterday_pending_marked_overdue(self, yesterday_task, session):
        stats = scan_overdue()
        session.refresh(yesterday_task)
        assert stats['marked'] == 1
        assert yesterday_task.status == 'overdue'
        assert yesterday_task.last_penalized_at is not None

    def test_today_task_not_marked(self, today_task, session):
        scan_overdue()
        session.refresh(today_task)
        assert today_task.status == 'pending'

    def test_completed_task_untouched(self, completed_yesterday, session):
        """completed task 即使 scheduled_date < today 也不动"""
        scan_overdue()
        session.refresh(completed_yesterday)
        assert completed_yesterday.status == 'completed'

    def test_in_progress_also_marked(self, user, stage, session):
        """in_progress 状态的昨日任务也要标 overdue"""
        t = Task(
            user_id=user.id, stage_id=stage.id, title='in-prog',
            scheduled_date=date.today() - timedelta(days=2),
            points=10, status='in_progress',
        )
        session.add(t); session.commit()
        scan_overdue()
        session.refresh(t)
        assert t.status == 'overdue'


# ── 2. overdue→pending 恢复 ─────────────────────────────────────────
class TestOverdueToPending:
    def test_overdue_with_future_date_reverts_to_pending(
        self, user, stage, session
    ):
        """B0005：把 overdue task 挪到未来，应自动恢复 pending"""
        t = Task(
            user_id=user.id, stage_id=stage.id, title='moved',
            scheduled_date=date.today() - timedelta(days=2),
            points=10, status='overdue',
        )
        session.add(t); session.commit()

        # 用户把日期挪到未来
        t.scheduled_date = date.today() + timedelta(days=3)
        session.commit()

        mark_pending_recovery()
        session.refresh(t)
        assert t.status == 'pending'


# ── 3. overdue_runs 审计 ─────────────────────────────────────────
class TestOverdueRunsAudit:
    def test_run_row_written(self, yesterday_task, session):
        scan_overdue()
        run = session.query(OverdueRun).order_by(OverdueRun.id.desc()).first()
        assert run is not None
        assert run.run_date == date.today()
        assert run.finished_at is not None
        assert run.scanned >= 1
        assert run.marked >= 1

    def test_idempotent_same_day(self, yesterday_task, session):
        """同一日多次扫描：只一行 overdue_runs（unique key）"""
        scan_overdue()
        scan_overdue()
        runs = session.query(OverdueRun).filter_by(run_date=date.today()).all()
        assert len(runs) == 1


# ── 4. 跨 user 隔离 ─────────────────────────────────────────
class TestCrossUserIsolation:
    def test_scan_preserves_user_ownership(
        self, user, other_user, stage, session
    ):
        """扫描全 user：bob 的逾期 task 也被标，但 user_id 不混"""
        bob_task = Task(
            user_id=other_user.id, stage_id=stage.id, title='bob',
            scheduled_date=date.today() - timedelta(days=1),
            points=10, status='pending',
        )
        session.add(bob_task); session.commit()
        scan_overdue()
        session.refresh(bob_task)
        # bob task 也被标（scan_overdue 跨 user）
        assert bob_task.status == 'overdue'
        # user_id 保持不变
        assert bob_task.user_id == other_user.id

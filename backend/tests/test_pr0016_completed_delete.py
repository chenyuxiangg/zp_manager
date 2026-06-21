"""
PR0016 TDD：完成态任务不可删 409 + 计划含已完成 task 不可删 409

设计目标（PR0016 §2/§6）：
- DELETE /api/tasks/<id> 当 status='completed' → 409 TASK_ALREADY_COMPLETED
- DELETE /api/plans/<id> 当含 completed task → 409 PLAN_HAS_COMPLETED_TASKS
- 跨用户 completed task 返 403（不暴露状态）
- D3 精神保留：删除非 completed task 仍允许
"""
import pytest
from datetime import date, datetime
from models import Task, Stage, Plan
from utils import error_codes as ec


def _code(body):
    if 'code' in body:
        return body['code']
    if isinstance(body.get('error'), dict):
        return body['error'].get('code')
    return None


# ── 1. 任务级 409 ─────────────────────────────────────────
class TestDeleteCompletedTask:
    def test_delete_completed_task_returns_409(
        self, client, auth_headers, user, stage, session
    ):
        """完成态任务删除 → 409 TASK_ALREADY_COMPLETED"""
        t = Task(
            user_id=user.id, stage_id=stage.id, title='Done',
            scheduled_date=date.today(), points=10,
            status='completed', completed_at=datetime.utcnow(),
        )
        session.add(t); session.commit()

        res = client.delete(f'/api/tasks/{t.id}', headers=auth_headers)
        assert res.status_code == 409
        assert _code(res.get_json()) == 'TASK_ALREADY_COMPLETED'
        # 任务仍在
        session.refresh(t)
        assert session.query(Task).filter_by(id=t.id).first() is not None

    def test_delete_pending_task_succeeds(
        self, client, auth_headers, task
    ):
        """pending 任务删除 → 200"""
        res = client.delete(f'/api/tasks/{task.id}', headers=auth_headers)
        assert res.status_code == 200

    def test_delete_overdue_task_succeeds(
        self, client, auth_headers, user, stage, session
    ):
        """B0062 §6：overdue 状态（非 completed）允许删除"""
        from datetime import timedelta
        t = Task(
            user_id=user.id, stage_id=stage.id, title='overdue-task',
            scheduled_date=date.today() - timedelta(days=3),
            points=10, status='overdue',
        )
        session.add(t); session.commit()

        res = client.delete(f'/api/tasks/{t.id}', headers=auth_headers)
        assert res.status_code == 200

    def test_delete_in_progress_task_succeeds(
        self, client, auth_headers, user, stage, session
    ):
        """in_progress 状态允许删除"""
        t = Task(
            user_id=user.id, stage_id=stage.id, title='wip',
            scheduled_date=date.today(),
            points=10, status='in_progress',
        )
        session.add(t); session.commit()

        res = client.delete(f'/api/tasks/{t.id}', headers=auth_headers)
        assert res.status_code == 200

    def test_delete_other_users_completed_returns_403_not_409(
        self, client, auth_headers, other_user, stage, session
    ):
        """D7 优先：跨用户 completed task 返 403（不暴露状态）"""
        t = Task(
            user_id=other_user.id, stage_id=stage.id, title='bob-done',
            scheduled_date=date.today(), points=10,
            status='completed', completed_at=datetime.utcnow(),
        )
        session.add(t); session.commit()

        res = client.delete(f'/api/tasks/{t.id}', headers=auth_headers)
        assert res.status_code == 403
        # 必须是 403，不能是 409（避免暴露任务状态）
        assert res.status_code != 409


# ── 2. 计划级 409 ─────────────────────────────────────────
class TestDeletePlanWithCompletedTasks:
    def test_delete_plan_with_completed_task_returns_409(
        self, client, auth_headers, user, plan, stage, session
    ):
        """含 completed task 的 plan 不可删"""
        t = Task(
            user_id=user.id, stage_id=stage.id, title='done',
            scheduled_date=date.today(), points=10,
            status='completed', completed_at=datetime.utcnow(),
        )
        session.add(t); session.commit()

        res = client.delete(f'/api/plans/{plan.id}', headers=auth_headers)
        assert res.status_code == 409
        assert _code(res.get_json()) == 'PLAN_HAS_COMPLETED_TASKS'

    def test_delete_plan_with_only_pending_tasks_succeeds(
        self, client, auth_headers, plan, task
    ):
        """只含 pending task 的 plan 可删"""
        res = client.delete(f'/api/plans/{plan.id}', headers=auth_headers)
        assert res.status_code == 200

    def test_delete_plan_with_overdue_task_succeeds(
        self, client, auth_headers, user, plan, stage, session
    ):
        """含 overdue task（非 completed）的 plan 可删"""
        from datetime import timedelta
        t = Task(
            user_id=user.id, stage_id=stage.id, title='overdue',
            scheduled_date=date.today() - timedelta(days=2),
            points=10, status='overdue',
        )
        session.add(t); session.commit()

        res = client.delete(f'/api/plans/{plan.id}', headers=auth_headers)
        assert res.status_code == 200

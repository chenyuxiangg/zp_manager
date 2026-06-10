"""
迭代 4: PATCH /api/tasks/:id/toggle — 切换完成状态 + 积分回滚
"""
import pytest
from datetime import date, datetime, timedelta
from models import PointLog, Task


class TestTogglePendingToCompleted:
    """pending → completed：加积分"""

    def test_toggle_pending_task_returns_completed_status(self, client, auth_headers, task):
        res = client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        assert res.status_code == 200
        body = res.get_json()
        assert body['data']['task']['status'] == 'completed'
        assert body['data']['task']['completed_at'] is not None

    def test_toggle_pending_task_returns_positive_points_delta(self, client, auth_headers, task):
        res = client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        # task.points = 10, scheduled_date = today (on time) → full points
        assert res.get_json()['data']['points_delta'] == 10

    def test_toggle_pending_task_adds_points_to_user(self, client, auth_headers, task, user, session):
        user.points = 0
        session.commit()
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        session.refresh(user)
        assert user.points == 10

    def test_toggle_creates_point_log(self, client, auth_headers, task, session):
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        log = session.query(PointLog).filter_by(
            task_id=task.id, reason='task_completed'
        ).first()
        assert log is not None
        assert log.delta == 10


class TestToggleCompletedToPending:
    """completed → pending：扣积分（D1 决策）"""

    def test_toggle_completed_task_returns_pending_status(self, client, auth_headers, task):
        # 先完成
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        # 再撤销
        res = client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        assert res.status_code == 200
        body = res.get_json()
        assert body['data']['task']['status'] == 'pending'
        assert body['data']['task']['completed_at'] is None

    def test_toggle_uncomplete_returns_negative_points_delta(self, client, auth_headers, task):
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)  # +10
        res = client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)  # -10
        assert res.get_json()['data']['points_delta'] == -10

    def test_toggle_uncomplete_deducts_user_points(self, client, auth_headers, task, user, session):
        user.points = 0
        session.commit()
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        assert user.points == 10
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        session.refresh(user)
        assert user.points == 0

    def test_toggle_uncomplete_keeps_point_log_for_audit(self, client, auth_headers, task, session):
        """撤销完成不删除 PointLog（保留审计）"""
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        log = session.query(PointLog).filter_by(
            task_id=task.id, reason='task_completed'
        ).first()
        assert log is not None  # 审计保留


class TestToggleOverdueTask:
    """逾期任务使用半积分"""

    def test_overdue_task_uses_half_points(self, client, auth_headers, task, user, session):
        task.scheduled_date = date.today() - timedelta(days=2)
        user.points = 0
        session.commit()
        res = client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        # 10 // 2 = 5
        assert res.get_json()['data']['points_delta'] == 5
        session.refresh(user)
        assert user.points == 5

    def test_overdue_task_uncomplete_rolls_back_half_points(
        self, client, auth_headers, task, user, session
    ):
        task.scheduled_date = date.today() - timedelta(days=2)
        user.points = 0
        session.commit()
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)  # +5
        res = client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)  # -5
        assert res.get_json()['data']['points_delta'] == -5
        session.refresh(user)
        assert user.points == 0


class TestTogglePointsFloor:
    """积分下限保护：撤销不能扣成负数"""

    def test_user_points_never_negative(self, client, auth_headers, task, user, session):
        user.points = 0
        session.commit()
        # 反复 toggle 3 次（+10, -10, +10）
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        session.refresh(user)
        assert user.points >= 0


class TestToggleAuth:
    """认证与权限"""

    def test_toggle_without_token_returns_401(self, client, task):
        res = client.patch(f'/api/tasks/{task.id}/toggle')
        assert res.status_code == 401

    def test_toggle_other_users_task_returns_403(self, client, auth_headers, other_user, stage, session):
        """权限隔离：他人 task 返回 403（D7 决策）"""
        bob_task = Task(
            id=8001, user_id=other_user.id, stage_id=stage.id,
            title='Bob Task', scheduled_date=date.today()
        )
        session.add(bob_task)
        session.commit()
        res = client.patch(f'/api/tasks/{bob_task.id}/toggle', headers=auth_headers)
        assert res.status_code == 403

    def test_toggle_nonexistent_task_returns_404(self, client, auth_headers):
        res = client.patch('/api/tasks/99999/toggle', headers=auth_headers)
        assert res.status_code == 404


class TestToggleResponse:
    """响应结构：D1 决策要求返回 points_delta 供前端同步 user.points"""

    def test_toggle_response_includes_task_and_points_delta(self, client, auth_headers, task):
        res = client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        data = res.get_json()['data']
        assert 'task' in data
        assert 'points_delta' in data
        assert data['task']['id'] == task.id
        assert data['task']['title'] == 'T1'
        assert data['task']['points'] == 10

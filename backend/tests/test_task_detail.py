"""
迭代 2: GET /api/tasks/:id — 任务详情（含 join Stage/Plan）
"""
import pytest
from datetime import date, datetime
from models import db, User, Stage, Task


class TestGetTaskSuccess:
    """成功获取任务详情：含 stage/plan join"""

    def test_get_task_returns_basic_fields(self, client, auth_headers, task):
        res = client.get(f'/api/tasks/{task.id}', headers=auth_headers)
        assert res.status_code == 200
        body = res.get_json()
        assert body['success'] is True
        task_data = body['data']['task']
        assert task_data['id'] == task.id
        assert task_data['title'] == 'T1'
        assert task_data['description'] == 'task desc'
        assert task_data['points'] == 10
        assert task_data['status'] == 'pending'

    def test_get_task_returns_scheduled_date_iso_format(self, client, auth_headers, task):
        res = client.get(f'/api/tasks/{task.id}', headers=auth_headers)
        task_data = res.get_json()['data']['task']
        # ISO 格式 YYYY-MM-DD
        assert task_data['scheduled_date'] == date.today().isoformat()

    def test_get_task_returns_completed_at_when_null(self, client, auth_headers, task):
        res = client.get(f'/api/tasks/{task.id}', headers=auth_headers)
        task_data = res.get_json()['data']['task']
        assert task_data['completed_at'] is None

    def test_get_task_returns_completed_at_when_set(self, client, auth_headers, completed_task):
        res = client.get(f'/api/tasks/{completed_task.id}', headers=auth_headers)
        task_data = res.get_json()['data']['task']
        assert task_data['status'] == 'completed'
        assert task_data['completed_at'] is not None

    def test_get_task_returns_joined_stage(self, client, auth_headers, task, stage):
        """D6 决策：避免 N+1，一次返回 stage 信息"""
        res = client.get(f'/api/tasks/{task.id}', headers=auth_headers)
        task_data = res.get_json()['data']['task']
        assert 'stage' in task_data
        assert task_data['stage'] is not None
        assert task_data['stage']['id'] == stage.id
        assert task_data['stage']['title'] == 'S1'
        assert task_data['stage']['plan_id'] == stage.plan_id

    def test_get_task_returns_joined_plan(self, client, auth_headers, task, plan):
        """D6 决策：一次返回 plan 信息"""
        res = client.get(f'/api/tasks/{task.id}', headers=auth_headers)
        task_data = res.get_json()['data']['task']
        assert 'plan' in task_data
        assert task_data['plan'] is not None
        assert task_data['plan']['id'] == plan.id
        assert task_data['plan']['title'] == 'P1'


class TestGetTaskNotFound:
    """不存在的 task"""

    def test_get_nonexistent_task_returns_404(self, client, auth_headers):
        res = client.get('/api/tasks/99999', headers=auth_headers)
        assert res.status_code == 404
        body = res.get_json()
        assert body['success'] is False
        # PR0017：NOT_FOUND → RESOURCE_NOT_FOUND
        assert body['error']['code'] == 'RESOURCE_NOT_FOUND'

    def test_get_other_users_task_returns_403(self, client, auth_headers, other_user, stage, session):
        """权限隔离：他人 task 返回 403（D7 决策：存在但属于他人）"""
        # bob 的 task
        bob_task = Task(
            id=9001,
            user_id=other_user.id,
            stage_id=stage.id,
            title='Bob Task',
            scheduled_date=date.today(),
        )
        session.add(bob_task)
        session.commit()

        # alice 尝试访问
        res = client.get(f'/api/tasks/{bob_task.id}', headers=auth_headers)
        assert res.status_code == 403


class TestGetTaskAuth:
    """认证相关"""

    def test_get_task_without_token_returns_401(self, client, task):
        res = client.get(f'/api/tasks/{task.id}')
        assert res.status_code == 401

    def test_get_task_with_invalid_token_returns_401(self, client, task):
        res = client.get(f'/api/tasks/{task.id}', headers={
            'Authorization': 'Bearer invalid-token-here'
        })
        assert res.status_code == 401

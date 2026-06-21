"""
迭代 7: 跨用户操作区分 404 / 403（D7 决策实施）

联调报告遗留 #5：原 D7 决策是「统一返 404」已变更。
新 D7 决策（2026-06-06 联调后）：
- 任务/计划/阶段 不存在 → 404 RESOURCE_NOT_FOUND
- 任务/计划/阶段 存在但属于他人 → 403 PERMISSION_DENIED
- 评论 同理（不存 → 404，存在但属于他人 → 403）

实施范围：task get/update/delete/toggle/comment 三操作、plan get/update/delete
"""
import pytest
from datetime import date
from models import db, User, Stage, Task, Plan, Comment


class TestCrossUserTaskAccess:
    """Task 跨用户访问：先查存在性，再校验权限"""

    def test_get_other_users_task_returns_403(self, client, auth_headers, other_user, stage, session):
        """他人 task → 403（不是 404）"""
        bob_task = Task(
            id=7001, user_id=other_user.id, stage_id=stage.id,
            title='Bob Task', scheduled_date=date.today()
        )
        session.add(bob_task)
        session.commit()

        res = client.get(f'/api/tasks/{bob_task.id}', headers=auth_headers)
        assert res.status_code == 403
        # PR0017 B0181 + B0224：默认 code 改 NOT_OWNER（4 类 403 区分）
        assert res.get_json()['error']['code'] == 'NOT_OWNER'

    def test_update_other_users_task_returns_403(self, client, auth_headers, other_user, stage, session):
        bob_task = Task(
            id=7002, user_id=other_user.id, stage_id=stage.id,
            title='Bob Task', scheduled_date=date.today()
        )
        session.add(bob_task)
        session.commit()

        res = client.put(f'/api/tasks/{bob_task.id}',
                         json={'title': 'Hacked'}, headers=auth_headers)
        assert res.status_code == 403
        # 验证 Bob 的 task 未被改
        session.refresh(bob_task)
        assert bob_task.title == 'Bob Task'

    def test_delete_other_users_task_returns_403(self, client, auth_headers, other_user, stage, session):
        bob_task = Task(
            id=7003, user_id=other_user.id, stage_id=stage.id,
            title='Bob Task', scheduled_date=date.today()
        )
        session.add(bob_task)
        session.commit()

        res = client.delete(f'/api/tasks/{bob_task.id}', headers=auth_headers)
        assert res.status_code == 403
        # 验证 Bob 的 task 仍存在
        assert session.get(Task, bob_task.id) is not None

    def test_toggle_other_users_task_returns_403(self, client, auth_headers, other_user, stage, session):
        bob_task = Task(
            id=7004, user_id=other_user.id, stage_id=stage.id,
            title='Bob Task', scheduled_date=date.today()
        )
        session.add(bob_task)
        session.commit()

        res = client.patch(f'/api/tasks/{bob_task.id}/toggle', headers=auth_headers)
        assert res.status_code == 403

    def test_complete_other_users_task_returns_403(self, client, auth_headers, other_user, stage, session):
        bob_task = Task(
            id=7005, user_id=other_user.id, stage_id=stage.id,
            title='Bob Task', scheduled_date=date.today()
        )
        session.add(bob_task)
        session.commit()

        res = client.put(f'/api/tasks/{bob_task.id}/complete', headers=auth_headers)
        assert res.status_code == 403

    def test_nonexistent_task_still_returns_404(self, client, auth_headers):
        """不存在的 task 仍是 404（与 403 区分）"""
        res = client.get('/api/tasks/99999', headers=auth_headers)
        assert res.status_code == 404
        # PR0017：NOT_FOUND → RESOURCE_NOT_FOUND
        assert res.get_json()['error']['code'] == 'RESOURCE_NOT_FOUND'


class TestCrossUserPlanAccess:
    """Plan 跨用户访问"""

    def test_get_other_users_plan_returns_403(self, client, auth_headers, other_user, session):
        bob_plan = Plan(
            id=7001, user_id=other_user.id, title='Bob Plan',
            start_date=date.today(), end_date=date.today()
        )
        session.add(bob_plan)
        session.commit()

        res = client.get(f'/api/plans/{bob_plan.id}', headers=auth_headers)
        assert res.status_code == 403

    def test_update_other_users_plan_returns_403(self, client, auth_headers, other_user, session):
        bob_plan = Plan(
            id=7002, user_id=other_user.id, title='Bob Plan',
            start_date=date.today(), end_date=date.today()
        )
        session.add(bob_plan)
        session.commit()

        res = client.put(f'/api/plans/{bob_plan.id}',
                         json={'title': 'Hacked'}, headers=auth_headers)
        assert res.status_code == 403
        session.refresh(bob_plan)
        assert bob_plan.title == 'Bob Plan'

    def test_delete_other_users_plan_returns_403(self, client, auth_headers, other_user, session):
        bob_plan = Plan(
            id=7003, user_id=other_user.id, title='Bob Plan',
            start_date=date.today(), end_date=date.today()
        )
        session.add(bob_plan)
        session.commit()

        res = client.delete(f'/api/plans/{bob_plan.id}', headers=auth_headers)
        assert res.status_code == 403
        assert session.get(Plan, bob_plan.id) is not None


class TestCrossUserStageAccess:
    """Stage 跨用户访问"""

    def test_update_other_users_stage_returns_403(self, client, auth_headers, other_user, session):
        bob_plan = Plan(
            id=7010, user_id=other_user.id, title='Bob Plan',
            start_date=date.today(), end_date=date.today()
        )
        session.add(bob_plan)
        session.commit()
        bob_stage = Stage(
            id=7011, plan_id=bob_plan.id, title='Bob Stage',
            order_num=1, start_date=date.today(), end_date=date.today()
        )
        session.add(bob_stage)
        session.commit()

        res = client.put(f'/api/stages/{bob_stage.id}',
                         json={'title': 'Hacked'}, headers=auth_headers)
        assert res.status_code == 403

    def test_delete_other_users_stage_returns_403(self, client, auth_headers, other_user, session):
        bob_plan = Plan(
            id=7012, user_id=other_user.id, title='Bob Plan',
            start_date=date.today(), end_date=date.today()
        )
        session.add(bob_plan)
        session.commit()
        bob_stage = Stage(
            id=7013, plan_id=bob_plan.id, title='Bob Stage',
            order_num=1, start_date=date.today(), end_date=date.today()
        )
        session.add(bob_stage)
        session.commit()

        res = client.delete(f'/api/stages/{bob_stage.id}', headers=auth_headers)
        assert res.status_code == 403
        assert session.get(Stage, bob_stage.id) is not None


class TestCrossUserCommentAccess:
    """Comment 跨用户访问（编辑/删除）"""

    def test_update_other_users_comment_returns_403(self, client, auth_headers, other_user, task, session):
        bob_comment = Comment(
            id=7020, task_id=task.id, user_id=other_user.id, content='Bob Comment'
        )
        session.add(bob_comment)
        session.commit()

        res = client.put(f'/api/tasks/{task.id}/comments/{bob_comment.id}',
                         json={'content': 'Hacked'}, headers=auth_headers)
        assert res.status_code == 403
        session.refresh(bob_comment)
        assert bob_comment.content == 'Bob Comment'

    def test_delete_other_users_comment_returns_403(self, client, auth_headers, other_user, task, session):
        bob_comment = Comment(
            id=7021, task_id=task.id, user_id=other_user.id, content='Bob Comment'
        )
        session.add(bob_comment)
        session.commit()

        res = client.delete(f'/api/tasks/{task.id}/comments/{bob_comment.id}',
                            headers=auth_headers)
        assert res.status_code == 403
        assert session.get(Comment, bob_comment.id) is not None

    def test_get_comments_includes_others_with_username(self, client, auth_headers, other_user, task, session):
        """看他人评论仍然返回（但 username 字段标识作者）"""
        # alice 的评论
        c_alice = Comment(
            id=7030, task_id=task.id, user_id=task.user_id, content='Alice comment'
        )
        c_bob = Comment(
            id=7031, task_id=task.id, user_id=other_user.id, content='Bob comment'
        )
        session.add_all([c_alice, c_bob])
        session.commit()

        res = client.get(f'/api/tasks/{task.id}/comments', headers=auth_headers)
        assert res.status_code == 200
        comments = res.get_json()['data']['comments']
        usernames = {c['username'] for c in comments}
        assert 'alice' in usernames
        assert 'bob' in usernames

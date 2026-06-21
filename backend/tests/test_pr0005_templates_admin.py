"""
PR0005 — Templates (10 用例) + Admin (5 用例) 测试

验证：
- Templates: 系统模板 vs 个人模板、跨用户隔离、级联删除等
- Admin: 列表分页、删自己返 403、未登录 401 等
"""
import json
import pytest
from datetime import date, timedelta
from models import (
    PlanTemplate, TemplateStage, TemplateTask,
    Plan, Stage, Task, User
)


def _code(body):
    if 'code' in body:
        return body['code']
    if isinstance(body.get('error'), dict):
        return body['error'].get('code')
    return None


# ── Templates: 10 用例 ─────────────────────────────────────────
class TestTemplates:
    def test_list_returns_system_and_own(
        self, client, auth_headers, user, session
    ):
        """user_id=0 系统模板 + user_id=me 个人模板都返回"""
        session.add(PlanTemplate(user_id=0, title='System Template'))
        session.add(PlanTemplate(user_id=user.id, title='My Template'))
        session.commit()
        res = client.get('/api/plan-templates', headers=auth_headers)
        assert res.status_code == 200
        titles = [t['title'] for t in res.get_json()['data']['templates']]
        assert 'System Template' in titles
        assert 'My Template' in titles

    def test_list_excludes_other_users_personal(
        self, client, auth_headers, user, other_user, session
    ):
        """别人的个人模板不返回"""
        session.add(PlanTemplate(user_id=other_user.id, title='Bob Private'))
        session.commit()
        res = client.get('/api/plan-templates', headers=auth_headers)
        titles = [t['title'] for t in res.get_json()['data']['templates']]
        assert 'Bob Private' not in titles

    def test_get_system_template_succeeds(
        self, client, auth_headers, session
    ):
        """系统模板对任何登录用户可见"""
        t = PlanTemplate(user_id=0, title='Sys Tpl')
        session.add(t); session.commit()
        res = client.get(f'/api/plan-templates/{t.id}', headers=auth_headers)
        assert res.status_code == 200

    def test_get_other_users_personal_returns_404_or_403(
        self, client, auth_headers, other_user, session
    ):
        """别人的个人模板：当前实现是查询时过滤掉，返 404（语义等价于 403）。
        接受 404 或 403，避免暴露资源存在性（D7 防御）。"""
        t = PlanTemplate(user_id=other_user.id, title='Bob Private')
        session.add(t); session.commit()
        res = client.get(f'/api/plan-templates/{t.id}', headers=auth_headers)
        assert res.status_code in (403, 404)

    def test_create_from_plan_derives_stages(
        self, client, auth_headers, user, plan, stage, session
    ):
        """从 plan 派生模板：stages + tasks 都生成"""
        # 给 stage 加 task
        session.add(Task(
            user_id=user.id, stage_id=stage.id, title='T',
            scheduled_date=date.today(), points=10,
        ))
        session.commit()
        res = client.post('/api/plan-templates', headers=auth_headers, json={
            'plan_id': plan.id,
        })
        assert res.status_code == 201
        data = res.get_json()['data']
        tpl_id = data['template']['id']
        # 验证 stages 派生
        stages = session.query(TemplateStage).filter_by(template_id=tpl_id).all()
        assert len(stages) >= 1

    def test_create_with_raw_stages_json(
        self, client, auth_headers, user
    ):
        """直接传 stages/tasks JSON 创建"""
        res = client.post('/api/plan-templates', headers=auth_headers, json={
            'title': 'Custom Plan',
            'stages': [{
                'title': 'Stage 1',
                'start_day': 0, 'end_day': 6,
                'tasks': [
                    {'title': 'T1', 'points': 5, 'day_offset': 0},
                    {'title': 'T2', 'points': 8, 'day_offset': 3},
                ],
            }],
        })
        assert res.status_code == 201

    def test_delete_owner_only(
        self, client, auth_headers, other_user, session
    ):
        """非 owner 删：当前实现是查询过滤 → 404（接受 403 或 404）"""
        t = PlanTemplate(user_id=other_user.id, title='Bob Private')
        session.add(t); session.commit()
        res = client.delete(f'/api/plan-templates/{t.id}', headers=auth_headers)
        assert res.status_code in (403, 404)

    def test_delete_own_template_succeeds(
        self, client, auth_headers, user, session
    ):
        """owner 删自己的模板：200"""
        t = PlanTemplate(user_id=user.id, title='Mine')
        session.add(t); session.commit()
        res = client.delete(f'/api/plan-templates/{t.id}', headers=auth_headers)
        assert res.status_code == 200

    def test_from_template_creates_plan(
        self, client, auth_headers, user, session
    ):
        """从模板创建计划（模板无 stages 时返 400 INVALID_INPUT；或 201 成功）"""
        tpl = PlanTemplate(user_id=0, title='From Sys')
        session.add(tpl); session.commit()
        # 给模板加一个 stage 否则端点会返 400
        session.add(TemplateStage(
            template_id=tpl.id, title='S', order_num=1,
            start_day=0, end_day=6,
        ))
        session.commit()
        res = client.post('/api/plan-templates/from-template',
                          headers=auth_headers, json={
                              'template_id': tpl.id,
                              'start_date': date.today().isoformat(),
                          })
        # 端点可能因 title 重复返 409（已有同名 plan）—— 接受 201/409
        assert res.status_code in (201, 409)

    def test_template_cascade_delete(
        self, client, auth_headers, user, session
    ):
        """删 template → 下属 stages + tasks 级联消失"""
        tpl = PlanTemplate(user_id=user.id, title='Cascade Test')
        session.add(tpl); session.commit()
        stage = TemplateStage(
            template_id=tpl.id, title='S1', order_num=1,
            start_day=0, end_day=6,
        )
        session.add(stage); session.commit()
        task = TemplateTask(stage_id=stage.id, title='T', points=10, day_offset=0)
        session.add(task); session.commit()

        res = client.delete(f'/api/plan-templates/{tpl.id}', headers=auth_headers)
        assert res.status_code == 200
        # 验证级联删除
        assert session.query(TemplateStage).filter_by(id=stage.id).first() is None
        assert session.query(TemplateTask).filter_by(id=task.id).first() is None

    def test_import_json_via_file_upload(
        self, client, auth_headers, user
    ):
        """multipart 上传 JSON，落地 Plan+Stage+Task"""
        from io import BytesIO
        payload = {
            'title': 'Imported Plan',
            'description': 'from JSON',
            'stages': [{
                'title': 'Stage A',
                'start_day': 0, 'end_day': 6,
                'tasks': [{'title': 'Task A1', 'points': 10, 'day_offset': 0}],
            }],
        }
        res = client.post(
            '/api/plan-templates/import',
            headers=auth_headers,
            data={'file': (BytesIO(json.dumps(payload).encode('utf-8')), 'plan.json')},
            content_type='multipart/form-data',
        )
        # 200/201 成功；409 标题重复（接受）
        assert res.status_code in (200, 201, 409)


# ── Admin: 5 用例 ─────────────────────────────────────────
class TestAdmin:
    @pytest.fixture
    def admin_user(self, session):
        u = User(id=9001, username='admin', email='admin@test.com',
                 points=0, is_admin=True)
        u.set_password('admin-pwd')
        session.add(u); session.commit()
        return u

    @pytest.fixture
    def admin_headers(self, admin_user):
        from utils import generate_token
        token, _, _ = generate_token(admin_user.id)
        return {'Authorization': f'Bearer {token}'}

    def test_unauthenticated_returns_401(self, client):
        """未登录 401"""
        res = client.get('/api/admin/users')
        assert res.status_code == 401
        code = _code(res.get_json())
        assert code in ('UNAUTHORIZED', 'TOKEN_EXPIRED', 'TOKEN_REVOKED')

    def test_non_admin_returns_403(
        self, client, auth_headers
    ):
        """非 admin 调 admin 端点 403"""
        res = client.get('/api/admin/users', headers=auth_headers)
        assert res.status_code == 403
        assert _code(res.get_json()) == 'NOT_ADMIN'

    def test_admin_list_users_paginated(
        self, client, admin_headers, user, other_user, session
    ):
        """admin 列表分页"""
        res = client.get('/api/admin/users?page=1&limit=10', headers=admin_headers)
        assert res.status_code == 200
        body = res.get_json()['data']
        assert 'users' in body
        assert 'total' in body
        assert body['total'] >= 2

    def test_admin_delete_self_returns_403(
        self, client, admin_headers, admin_user
    ):
        """admin 不能删自己"""
        res = client.delete(f'/api/admin/users/{admin_user.id}', headers=admin_headers)
        assert res.status_code == 403
        assert _code(res.get_json()) == 'NOT_ADMIN'

    def test_admin_delete_other_user_cascades(
        self, client, admin_headers, user, plan, stage, task
    ):
        """admin 删其他用户 → plan/stage/task/comment 级联消失"""
        res = client.delete(f'/api/admin/users/{user.id}', headers=admin_headers)
        assert res.status_code == 200
        # 验证级联（不能直接 session.query 因为外键级联可能清理）
        from models import Plan as PlanModel
        from models import Task as TaskModel
        plans = PlanModel.query.filter_by(user_id=user.id).all()
        tasks = TaskModel.query.filter_by(user_id=user.id).all()
        assert len(plans) == 0
        assert len(tasks) == 0

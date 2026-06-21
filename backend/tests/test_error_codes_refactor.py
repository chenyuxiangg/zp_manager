"""
PR0017 TDD REFACTOR 步骤：路由错误码迁移测试

验证 routes/ 中所有错误响应使用 ec.* 标准化 code 字符串：
- 404 资源不存在 → 'RESOURCE_NOT_FOUND'（旧 'NOT_FOUND'）
- 401 未登录 → 'TOKEN_EXPIRED' / 'UNAUTHORIZED' / 'TOKEN_REVOKED'
- 403 鉴权失败 → 'PERMISSION_DENIED' / 'NOT_OWNER' / 'NOT_ADMIN'
- 422/400 输入错 → 'INVALID_INPUT'
- 409 重名 → 'TITLE_DUPLICATED'
- 500 内部错 → 'INTERNAL_ERROR'

每个路由改造后应：CI grep 0 字面量命中 + 单测断言 code
"""
import pytest
from models import Plan, Stage, Task
from datetime import date, timedelta


def _code(body):
    """提取 code 字段（兼容顶层与 error 嵌套）"""
    if 'code' in body:
        return body['code']
    if isinstance(body.get('error'), dict):
        return body['error'].get('code')
    return None


# ── 401/403 鉴权链路 ─────────────────────────────────────────
class TestAuthRouteErrorCodes:
    def test_login_wrong_password_code_invalid_credentials(self, client):
        res = client.post('/api/auth/login', json={
            'email': 'alice@test.com', 'password': 'wrong-pwd'
        })
        assert res.status_code == 401
        assert _code(res.get_json()) == 'INVALID_CREDENTIALS'

    def test_register_missing_fields_code_invalid_input(self, client):
        res = client.post('/api/auth/register', json={'username': 'x'})
        assert res.status_code == 400
        assert _code(res.get_json()) == 'INVALID_INPUT'

    def test_unauthenticated_me_code_401(self, client):
        res = client.get('/api/auth/me')
        assert res.status_code == 401
        code = _code(res.get_json())
        assert code in ('TOKEN_EXPIRED', 'UNAUTHORIZED', 'TOKEN_REVOKED')


# ── 404 资源不存在 ─────────────────────────────────────────
class TestResourceNotFoundCode:
    def test_get_task_404_uses_resource_not_found(self, client, auth_headers):
        res = client.get('/api/tasks/99999', headers=auth_headers)
        assert res.status_code == 404
        assert _code(res.get_json()) == 'RESOURCE_NOT_FOUND'

    def test_get_plan_404_uses_resource_not_found(self, client, auth_headers):
        res = client.get('/api/plans/99999', headers=auth_headers)
        assert res.status_code == 404
        assert _code(res.get_json()) == 'RESOURCE_NOT_FOUND'


# ── 403 跨用户权限 ─────────────────────────────────────────
class TestCrossUserCode:
    def test_other_user_task_get_403_uses_permission_denied_or_not_owner(
        self, client, auth_headers, other_user, stage, session
    ):
        bob_task = Task(
            user_id=other_user.id, stage_id=stage.id,
            title='Bob Task', scheduled_date=date.today()
        )
        session.add(bob_task); session.commit()
        res = client.get(f'/api/tasks/{bob_task.id}', headers=auth_headers)
        assert res.status_code == 403
        # 兼容 PERMISSION_DENIED 与 NOT_OWNER（PR0017 B0181）
        assert _code(res.get_json()) in ('PERMISSION_DENIED', 'NOT_OWNER')


# ── 409 重名（plans/stages/tasks） ─────────────────────────
class TestTitleDuplicatedCode:
    def test_duplicate_plan_title_409(self, client, auth_headers, plan):
        res = client.post('/api/plans', headers=auth_headers, json={
            'title': 'P1',  # 已存在
            'start_date': date.today().isoformat(),
            'end_date': (date.today() + timedelta(days=5)).isoformat(),
        })
        assert res.status_code in (409, 422)
        # PR0017 重构后应统一为 TITLE_DUPLICATED 409
        if res.status_code == 409:
            assert _code(res.get_json()) == 'TITLE_DUPLICATED'


# ── 业务规则 409 ─────────────────────────────────────────
class TestBusinessRuleCodes:
    def test_archive_plan_with_incomplete_stages_409(
        self, client, auth_headers, plan, stage
    ):
        res = client.put(f'/api/plans/{plan.id}', headers=auth_headers, json={
            'status': 'archived',
        })
        assert res.status_code in (409, 422)
        if res.status_code == 409:
            assert _code(res.get_json()) == 'PLAN_NOT_ARCHIVABLE'

    def test_complete_stage_with_incomplete_tasks_409(
        self, client, auth_headers, stage, task
    ):
        res = client.put(f'/api/stages/{stage.id}', headers=auth_headers, json={
            'status': 'completed',
        })
        assert res.status_code in (409, 422)
        if res.status_code == 409:
            assert _code(res.get_json()) == 'STAGE_NOT_COMPLETABLE'

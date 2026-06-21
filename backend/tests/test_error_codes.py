"""
PR0017 TDD 步骤 1（RED）：utils/error_codes.py 单元测试

验证：
1. ≥16 个 ErrorCode 常量，每条带 code/message/http_status
2. 工厂函数 unauthorized/forbidden/not_found/conflict 返 (jsonify, status)
3. 响应体结构向后兼容 success/error 字段，新增 code 字段
4. 不同 code 走不同 status（401 vs 403 vs 404 vs 409 vs 500）
"""
import pytest
from utils import error_codes as ec


# ── 1. ErrorCode 常量覆盖 ─────────────────────────────────────────
class TestErrorCodeConstants:
    def test_invalid_credentials_exists(self):
        assert ec.INVALID_CREDENTIALS.code == 'INVALID_CREDENTIALS'
        assert ec.INVALID_CREDENTIALS.http_status == 401

    def test_token_expired_exists(self):
        assert ec.TOKEN_EXPIRED.code == 'TOKEN_EXPIRED'
        assert ec.TOKEN_EXPIRED.http_status == 401

    def test_permission_denied_exists(self):
        assert ec.PERMISSION_DENIED.code == 'PERMISSION_DENIED'
        assert ec.PERMISSION_DENIED.http_status == 403

    def test_not_admin_exists(self):
        assert ec.NOT_ADMIN.code == 'NOT_ADMIN'
        assert ec.NOT_ADMIN.http_status == 403

    def test_not_owner_exists(self):
        """PR0017 §1 B0181：资源非 owner 独立 code"""
        assert ec.NOT_OWNER.code == 'NOT_OWNER'
        assert ec.NOT_OWNER.http_status == 403

    def test_resource_not_found_exists(self):
        assert ec.RESOURCE_NOT_FOUND.code == 'RESOURCE_NOT_FOUND'
        assert ec.RESOURCE_NOT_FOUND.http_status == 404

    def test_task_already_completed_exists(self):
        """PR0016 前置（B0167）"""
        assert ec.TASK_ALREADY_COMPLETED.code == 'TASK_ALREADY_COMPLETED'
        assert ec.TASK_ALREADY_COMPLETED.http_status == 409

    def test_pomodoro_already_running_exists(self):
        """PR0008 前置"""
        assert ec.POMODORO_ALREADY_RUNNING.code == 'POMODORO_ALREADY_RUNNING'
        assert ec.POMODORO_ALREADY_RUNNING.http_status == 409

    def test_rate_limited_exists(self):
        """PR0003 前置"""
        assert ec.RATE_LIMITED.code == 'RATE_LIMITED'
        assert ec.RATE_LIMITED.http_status == 409

    def test_invalid_input_exists(self):
        assert ec.INVALID_INPUT.code == 'INVALID_INPUT'
        assert ec.INVALID_INPUT.http_status == 400

    def test_title_duplicated_exists(self):
        assert ec.TITLE_DUPLICATED.code == 'TITLE_DUPLICATED'
        assert ec.TITLE_DUPLICATED.http_status == 409

    def test_internal_error_exists(self):
        assert ec.INTERNAL_ERROR.code == 'INTERNAL_ERROR'
        assert ec.INTERNAL_ERROR.http_status == 500

    def test_all_error_codes_have_unique_codes(self):
        """同一 code 名字重复 = 命名冲突"""
        codes = [v.code for v in ec.ALL_CODES]
        assert len(codes) == len(set(codes))

    def test_all_error_codes_have_http_status_4xx_or_5xx(self):
        for v in ec.ALL_CODES:
            assert 400 <= v.http_status < 600, f'{v.code} has invalid status {v.http_status}'

    def test_at_least_16_error_codes_defined(self):
        """验收硬指标：≥15 + 1 缓冲"""
        assert len(ec.ALL_CODES) >= 16


# ── 2. 工厂函数语义 ─────────────────────────────────────────
class TestFactoryFunctions:
    def test_unauthorized_returns_tuple_of_response_and_status(self, app):
        with app.app_context():
            resp, status = ec.unauthorized(ec.INVALID_CREDENTIALS)
        assert status == 401

    def test_forbidden_returns_403(self, app):
        with app.app_context():
            _, status = ec.forbidden(ec.PERMISSION_DENIED)
        assert status == 403

    def test_not_found_returns_404(self, app):
        with app.app_context():
            _, status = ec.not_found(ec.RESOURCE_NOT_FOUND)
        assert status == 404

    def test_conflict_returns_409(self, app):
        with app.app_context():
            _, status = ec.conflict(ec.TASK_ALREADY_COMPLETED)
        assert status == 409


# ── 3. 响应体结构（向后兼容） ─────────────────────────────────
class TestResponseShape:
    def test_response_body_contains_success_false(self, app):
        with app.app_context():
            resp, _ = ec.unauthorized(ec.INVALID_CREDENTIALS)
        body = resp.get_json()
        assert body['success'] is False

    def test_response_body_contains_error_message(self, app):
        """RR1 既有：前端 message 用"""
        with app.app_context():
            resp, _ = ec.unauthorized(ec.INVALID_CREDENTIALS)
        body = resp.get_json()
        assert 'error' in body
        # 兼容：error 可以是 dict 含 code/message，也可以是字符串
        if isinstance(body['error'], dict):
            assert 'message' in body['error']
        else:
            assert isinstance(body['error'], str)

    def test_response_body_contains_code_field(self, app):
        """PR0017 新增：前端精确判断"""
        with app.app_context():
            resp, _ = ec.unauthorized(ec.INVALID_CREDENTIALS)
        body = resp.get_json()
        # code 在 body 顶层 OR 在 error 嵌套里都接受
        if 'code' in body:
            assert body['code'] == 'INVALID_CREDENTIALS'
        else:
            assert body['error']['code'] == 'INVALID_CREDENTIALS'

    def test_factory_accepts_extra_kwargs(self, app):
        """PR0003 retry_after_seconds 等动态字段"""
        with app.app_context():
            resp, _ = ec.conflict(ec.RATE_LIMITED, retry_after_seconds=120)
        body = resp.get_json()
        # 透传 extra 字段
        flat = {k: v for k, v in body.items() if k not in ('success', 'error', 'data', 'message')}
        if 'retry_after_seconds' in flat:
            assert flat['retry_after_seconds'] == 120


# ── 4. 路由响应也带 code 字段（黑盒） ─────────────────────────────
class TestRouteResponsesCarryCodeField:
    def test_login_wrong_password_returns_401_with_code(self, client):
        """集成测试：登录失败必须带 code: INVALID_CREDENTIALS"""
        res = client.post('/api/auth/login', json={
            'email': 'alice@test.com', 'password': 'wrong'
        })
        assert res.status_code == 401
        body = res.get_json()
        code = body.get('code') or body.get('error', {}).get('code')
        assert code == 'INVALID_CREDENTIALS', f"got code={code!r}, body={body}"

    def test_unauthenticated_returns_401(self, client):
        res = client.get('/api/auth/me')
        assert res.status_code == 401
        body = res.get_json()
        # 接受 TOKEN_EXPIRED / UNAUTHORIZED / TOKEN_REVOKED 之一
        code = body.get('code') or body.get('error', {}).get('code')
        assert code in ('TOKEN_EXPIRED', 'UNAUTHORIZED', 'TOKEN_REVOKED'), f"got code={code!r}"

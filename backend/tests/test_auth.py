"""
迭代 1: 登录失败返回 INVALID_CREDENTIALS + 中文化 message
"""
import pytest


class TestLoginInvalidCredentials:
    """需求 3：输错密码应提示"用户名或密码不正确"（FE UX 方案）"""

    def test_login_wrong_password_returns_invalid_credentials_code(self, client, user):
        """密码错误 → 401 + code: INVALID_CREDENTIALS"""
        res = client.post('/api/auth/login', json={
            'email': 'alice@test.com',
            'password': 'wrong_password'
        })
        assert res.status_code == 401
        body = res.get_json()
        assert body['success'] is False
        assert body['error']['code'] == 'INVALID_CREDENTIALS'
        assert '用户名或密码不正确' in body['error']['message']

    def test_login_nonexistent_email_returns_invalid_credentials_code(self, client):
        """邮箱不存在也返回 INVALID_CREDENTIALS（避免邮箱枚举攻击）"""
        res = client.post('/api/auth/login', json={
            'email': 'nobody@test.com',
            'password': 'any'
        })
        assert res.status_code == 401
        assert res.get_json()['error']['code'] == 'INVALID_CREDENTIALS'

    def test_login_does_not_leak_user_existence(self, client, user):
        """密码错误和邮箱不存在的响应应一致（防止邮箱枚举）"""
        res_wrong_pw = client.post('/api/auth/login', json={
            'email': 'alice@test.com', 'password': 'wrong'
        })
        res_no_user = client.post('/api/auth/login', json={
            'email': 'noone@test.com', 'password': 'wrong'
        })
        assert res_wrong_pw.get_json()['error']['code'] == res_no_user.get_json()['error']['code']
        assert res_wrong_pw.get_json()['error']['message'] == res_no_user.get_json()['error']['message']


class TestLoginSuccess:
    """正常登录回归测试（确保改动不破坏成功路径）"""

    def test_login_correct_credentials_succeeds(self, client, user):
        res = client.post('/api/auth/login', json={
            'email': 'alice@test.com',
            'password': 'password123'
        })
        assert res.status_code == 200
        body = res.get_json()
        assert body['success'] is True
        assert 'token' in body['data']
        assert body['data']['user']['email'] == 'alice@test.com'

    def test_login_returns_user_info(self, client, user):
        res = client.post('/api/auth/login', json={
            'email': 'alice@test.com',
            'password': 'password123'
        })
        user_data = res.get_json()['data']['user']
        assert user_data['username'] == 'alice'
        assert 'points' in user_data
        assert 'is_admin' in user_data


class TestLoginValidation:
    """输入校验回归测试"""

    def test_login_missing_email_returns_validation_error(self, client):
        res = client.post('/api/auth/login', json={'password': 'x'})
        assert res.status_code == 422
        assert res.get_json()['error']['code'] == 'VALIDATION_ERROR'

    def test_login_missing_password_returns_validation_error(self, client):
        res = client.post('/api/auth/login', json={'email': 'a@b.com'})
        assert res.status_code == 422
        assert res.get_json()['error']['code'] == 'VALIDATION_ERROR'

    def test_login_empty_body_returns_validation_error(self, client):
        res = client.post('/api/auth/login', json={})
        assert res.status_code == 422
        assert res.get_json()['error']['code'] == 'VALIDATION_ERROR'

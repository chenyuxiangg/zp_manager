"""
PR0012 TDD — onboarded 字段后端透传

设计（PR0012 §2-4）：
- 新用户注册时 notify_config.onboarded = false
- /api/users/notify-config 透传 onboarded 字段
- /api/auth/me 返回 notify_config 含 onboarded
- PUT notify-config 可更新 onboarded
"""
import pytest
from models import User


class TestOnboardedField:
    def test_register_sets_onboarded_false(
        self, client, session
    ):
        """注册时 notify_config.onboarded 默认为 false"""
        res = client.post('/api/auth/register', json={
            'username': 'newuser',
            'email': 'new@test.com',
            'password': 'pwd123456',
        })
        assert res.status_code == 201
        u = User.query.filter_by(username='newuser').first()
        assert u is not None
        assert u.notify_config.get('onboarded') is False

    def test_get_me_returns_onboarded_field(
        self, client, auth_headers, user, session
    ):
        """/api/auth/me 返回的 user.notify_config 含 onboarded"""
        user.notify_config = user.notify_config or {}
        user.notify_config['onboarded'] = False
        session.commit()

        res = client.get('/api/auth/me', headers=auth_headers)
        assert res.status_code == 200
        body = res.get_json()['data']['user']
        assert 'onboarded' in body['notify_config']
        assert body['notify_config']['onboarded'] is False

    def test_put_notify_config_updates_onboarded(
        self, client, auth_headers, user, session
    ):
        """PUT /api/users/notify-config 接受 onboarded 字段"""
        user.notify_config = user.notify_config or {}
        user.notify_config['onboarded'] = False
        session.commit()

        res = client.put('/api/users/notify-config', headers=auth_headers, json={
            'notify_config': {**user.notify_config, 'onboarded': True},
        })
        assert res.status_code == 200
        session.refresh(user)
        assert user.notify_config['onboarded'] is True

    def test_put_notify_config_preserves_other_fields(
        self, client, auth_headers, user, session
    ):
        """PUT 时只送部分字段：浅合并，保留旧字段（PR0012 §6）"""
        user.notify_config = {
            'learn_reminder': {'enabled': True, 'timing': '1 day', 'channels': ['email']},
            'onboarded': False,
        }
        session.commit()

        # 前端只更新 onboarded 字段
        res = client.put('/api/users/notify-config', headers=auth_headers, json={
            'notify_config': {'onboarded': True},
        })
        assert res.status_code == 200
        session.refresh(user)
        # learn_reminder 仍保留（浅合并）
        assert user.notify_config['learn_reminder']['enabled'] is True
        # onboarded 更新
        assert user.notify_config['onboarded'] is True

    def test_unauthenticated_cannot_set_onboarded(
        self, client
    ):
        """未登录调 PUT notify-config 返 401"""
        res = client.put('/api/users/notify-config', json={
            'notify_config': {'onboarded': True},
        })
        assert res.status_code == 401

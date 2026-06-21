"""
B0330 修复契约测试 — /api/users/profile 响应 user 字典必须含 is_admin 字段。

背景：
- 集成阶段 B0330 揭示 backend/routes/users.py:24 user 字典漏 is_admin
- 前端 5 个组件依赖 user.is_admin（AppHeader/AppLayout/Admin.vue/PermissionButton.vue）
- 本测试守护：未来若误删 is_admin，admin 守卫失效立即被测出

覆盖：
- admin 用户登录 → GET /users/profile → 响应 user.is_admin === True
- 非 admin 用户登录 → GET /users/profile → 响应 user.is_admin === False
- 源码 grep 守护：routes/users.py get_profile 函数必须含 is_admin 字段
"""
import pytest
import re


def _make_admin(session):
    """创建一个 admin 用户（直接 is_admin=True）"""
    from models import User
    u = User(username='admin_test_user', email='admin@test.local')
    u.set_password('x')
    u.is_admin = True
    session.add(u)
    session.commit()
    return u


def _make_normal(session):
    """创建一个非 admin 用户"""
    from models import User
    u = User(username='normal_test_user', email='normal@test.local')
    u.set_password('x')
    u.is_admin = False
    session.add(u)
    session.commit()
    return u


def _auth_headers(user):
    """生成认证头"""
    from utils import generate_token
    token, _, _ = generate_token(user.id)
    return {'Authorization': f'Bearer {token}'}


def test_admin_user_profile_contains_is_admin_true(client, app, session):
    """B0330 admin 用户 profile 响应 user.is_admin 必须为 True"""
    admin = _make_admin(session)
    res = client.get('/api/users/profile', headers=_auth_headers(admin))
    assert res.status_code == 200
    body = res.get_json()
    assert body['success'] is True
    assert 'user' in body['data']
    assert 'is_admin' in body['data']['user'], "B0330: /users/profile user 字典必须含 is_admin 字段"
    assert body['data']['user']['is_admin'] is True


def test_normal_user_profile_contains_is_admin_false(client, app, session):
    """B0330 非 admin 用户 profile 响应 user.is_admin 必须为 False"""
    normal = _make_normal(session)
    res = client.get('/api/users/profile', headers=_auth_headers(normal))
    assert res.status_code == 200
    body = res.get_json()
    assert body['success'] is True
    assert 'is_admin' in body['data']['user'], "B0330: /users/profile user 字典必须含 is_admin 字段"
    assert body['data']['user']['is_admin'] is False


def test_profile_is_admin_field_in_users_route_source():
    """B0330 源码 grep 守护 — backend/routes/users.py get_profile 函数 user 字典必须含 is_admin"""
    with open('routes/users.py', 'r') as f:
        source = f.read()
    # 定位 get_profile 函数体中的 user 字典
    user_dict_match = re.search(r"'user':\s*\{[^}]+\}", source, re.DOTALL)
    assert user_dict_match is not None, "找不到 get_profile 函数 user 字典"
    user_dict = user_dict_match.group(0)
    assert 'is_admin' in user_dict, \
        "B0330: get_profile 函数 user 字典必须含 is_admin 字段"
import jwt
import logging
import os
import uuid
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g, current_app
from models import db, User, TokenBlacklist
from utils import error_codes as ec  # PR0017：所有错误码集中到 error_codes.py

log = logging.getLogger(__name__)


# 6.4 B0237：服务器时区一致性
# RR1 全部用 datetime.utcnow() + 各种 naive datetime；DB 列 created_at 假设 server-local
# 当前 RR2 不引入 tz-aware（避免业务大量返工），但加 server_now() 助手 + 启动时 sanity check
# RR3 全局 timezone 改造时（PR0002 配 users.timezone），统一替换为 tz-aware

SERVER_TIMEZONE = os.environ.get('TZ', '').strip() or 'server-local'


def server_now() -> datetime:
    """6.4 B0237：服务器本地时间 naive datetime（与 DB created_at 语义一致）。

    注：与 datetime.utcnow() 的差别——utcnow() 是 UTC（无 tz），server_now() 是
    server-local（无 tz）。当前所有 created_at/completed_at 等字段含义是
    "server-local 时间戳"，统一用 server_now() 避免后续 RR3 tz 改造时混淆。

    Returns:
        datetime: naive datetime 表示 server-local 当前时间
    """
    return datetime.now()


def server_today() -> 'date':
    """server-local 今天日期（与 task.scheduled_date 字段同语义）"""
    return datetime.now().date()


def check_server_timezone_on_startup(app):
    """6.4 B0237：启动时 sanity check——若 TZ 环境变量与 SERVER_TIMEZONE 不一致则告警。

    部署到不同时区 server 时静默错位的风险点：
    - DB created_at 写入 server-local
    - 前端展示 "scheduled_date" 是 date 类型（无 tz）
    - 跨时区用户凌晨完成任务归日可能错位（已加 users.timezone 字段留 RR3 处理）

    当前 RR2 策略：
    - 所有 datetime 字段用 server_now() 统一来源
    - cron 任务用 server-local 归日
    - 启动时打 log，便于运维快速确认 TZ 设置
    """
    import time
    detected_tz = time.tzname[time.daylight] if time.daylight else time.tzname[0]
    utc_offset = -(time.timezone if not time.daylight else time.altzone) / 3600
    log.info(
        f'[B0237] Server timezone: {detected_tz} '
        f'(UTC{utc_offset:+.0f}); '
        f'SERVER_TIMEZONE env: {SERVER_TIMEZONE!r}'
    )
    # 若未设置 TZ 显式值，给出 INFO 提示（不阻断）
    if 'TZ' not in os.environ:
        log.info(
            '[B0237] TZ env not set, using system default. '
            '建议显式设置 TZ=Asia/Shanghai 等，避免容器漂移。'
        )


def generate_token(user_id):
    expires_at = datetime.utcnow() + timedelta(seconds=current_app.config['JWT_ACCESS_TOKEN_EXPIRES'])
    payload = {
        'user_id': user_id,
        'exp': expires_at,
        'iat': datetime.utcnow(),
        'jti': f"{user_id}-{uuid.uuid4().hex}"
    }
    token = jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')
    return token, payload['jti'], expires_at


def decode_token(token):
    try:
        payload = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def verify_token(token):
    payload = decode_token(token)
    if not payload:
        return None

    blacklisted = TokenBlacklist.query.filter_by(jti=payload['jti']).first()
    if blacklisted:
        return None

    return payload


def token_required(f=None, *, role: str = None):
    """JWT 鉴权装饰器。

    用法：
        @token_required                        # 普通用户
        @token_required(role='admin')          # 需 admin 权限

    Args:
        role: 需要的角色（'admin' = is_admin=True）；None = 任意已登录用户
    """
    def decorator(func):
        @wraps(func)
        def decorated(*args, **kwargs):
            token = None
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]

            if not token:
                return ec.unauthorized(ec.UNAUTHORIZED, message='Token is missing')

            payload = verify_token(token)
            if not payload:
                return ec.unauthorized(ec.UNAUTHORIZED, message='Token is invalid or expired')

            g.current_user = User.query.get(payload['user_id'])
            if not g.current_user:
                return ec.unauthorized(ec.UNAUTHORIZED, message='User not found')

            # B0232：role 化 admin 鉴权（替代 routes/admin.py:admin_required）
            if role == 'admin' and not g.current_user.is_admin:
                return ec.forbidden(ec.NOT_ADMIN, message='Admin access required')

            return func(*args, **kwargs)
        return decorated

    # 兼容无参调用：@token_required
    if f is not None and callable(f):
        return decorator(f)
    return decorator


def create_response(success=True, data=None, message=None, error=None):
    response = {'success': success}
    if data is not None:
        response['data'] = data
    if message is not None:
        response['message'] = message
    if error is not None:
        response['error'] = error
    return response


def not_found(message='资源不存在', code=ec.RESOURCE_NOT_FOUND):
    """404 响应（PR0017：默认 code 升级为 ec.RESOURCE_NOT_FOUND）"""
    return ec.not_found(code, message=message)


def forbidden(message='无权限访问', code=ec.PERMISSION_DENIED):
    """403 响应（PR0017：默认 code 升级为 ec.PERMISSION_DENIED）"""
    return ec.forbidden(code, message=message)


def unauthorized(message='请先登录', code=ec.UNAUTHORIZED):
    """401 响应（PR0017：默认 code 升级为 ec.UNAUTHORIZED）"""
    return ec.unauthorized(code, message=message)


def check_resource_permission(obj, current_user, owner_field='user_id', resource_name='Resource'):
    """资源权限校验（D7 决策）

    - 不存在 → 404 RESOURCE_NOT_FOUND
    - 存在但属于他人 → 403 NOT_OWNER（B0224：B0181 4 类 403 之一）
    - 属于当前用户 → 返回 (None, obj) 由调用方继续
    """
    if obj is None:
        return not_found(message=f'{resource_name} not found'), None
    owner_id = getattr(obj, owner_field, None)
    if owner_id is None and hasattr(obj, 'plan'):
        # 嵌套资源（Stage → Plan.user_id）
        owner_id = obj.plan.user_id if obj.plan else None
    if owner_id != current_user.id:
        # B0224：默认 code 改 ec.NOT_OWNER（与 B0181 4 类 403 一致）
        return forbidden(
            code=ec.NOT_OWNER,
            message=f'You do not have permission to access this {resource_name.lower()}',
        ), None
    return None, obj


def locked_query(query):
    """根据数据库方言加行锁

    - MySQL / PostgreSQL：使用 SELECT ... FOR UPDATE 防止并发
    - SQLite：测试环境，不支持行锁，返回原 query（SQLite 默认串行化已足够测试）

    使用：
        task = locked_query(Task.query.filter_by(id=task_id)).first()
    """
    from models import db
    dialect = db.engine.dialect.name
    if dialect in ('mysql', 'postgresql'):
        return query.with_for_update()
    return query
import jwt
import uuid
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify, g, current_app
from models import db, User, TokenBlacklist


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


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]

        if not token:
            return jsonify({'success': False, 'error': {'code': 'UNAUTHORIZED', 'message': 'Token is missing'}}), 401

        payload = verify_token(token)
        if not payload:
            return jsonify({'success': False, 'error': {'code': 'UNAUTHORIZED', 'message': 'Token is invalid or expired'}}), 401

        g.current_user = User.query.get(payload['user_id'])
        if not g.current_user:
            return jsonify({'success': False, 'error': {'code': 'UNAUTHORIZED', 'message': 'User not found'}}), 401

        return f(*args, **kwargs)
    return decorated


def create_response(success=True, data=None, message=None, error=None):
    response = {'success': success}
    if data is not None:
        response['data'] = data
    if message is not None:
        response['message'] = message
    if error is not None:
        response['error'] = error
    return response


def not_found(message='Resource not found', code='NOT_FOUND'):
    """404 响应"""
    from flask import jsonify
    return jsonify(create_response(success=False, error={'code': code, 'message': message})), 404


def forbidden(message='Access denied', code='FORBIDDEN'):
    """403 响应"""
    from flask import jsonify
    return jsonify(create_response(success=False, error={'code': code, 'message': message})), 403


def unauthorized(message='Unauthorized', code='UNAUTHORIZED'):
    """401 响应"""
    from flask import jsonify
    return jsonify(create_response(success=False, error={'code': code, 'message': message})), 401


def check_resource_permission(obj, current_user, owner_field='user_id', resource_name='Resource'):
    """资源权限校验（D7 决策）
    - 不存在 → 404 NOT_FOUND
    - 存在但属于他人 → 403 FORBIDDEN
    - 属于当前用户 → 返回 (None, obj) 由调用方继续
    """
    if obj is None:
        return not_found(message=f'{resource_name} not found'), None
    owner_id = getattr(obj, owner_field, None)
    if owner_id is None and hasattr(obj, 'plan'):
        # 嵌套资源（Stage → Plan.user_id）
        owner_id = obj.plan.user_id if obj.plan else None
    if owner_id != current_user.id:
        return forbidden(message=f'You do not have permission to access this {resource_name.lower()}'), None
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
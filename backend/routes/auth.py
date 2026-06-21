from flask import Blueprint, request, jsonify, g, current_app
from models import db, User, TokenBlacklist
from utils import generate_token, token_required, create_response, decode_token
from utils import error_codes as ec  # PR0017
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not all([username, email, password]):
        return ec.bad_request(ec.INVALID_INPUT, message='缺少必填字段')

    if User.query.filter_by(email=email).first():
        return ec.bad_request(ec.INVALID_INPUT, message='Email already registered')

    if User.query.filter_by(username=username).first():
        return ec.bad_request(ec.INVALID_INPUT, message='Username already taken')

    user = User(username=username, email=email)
    user.set_password(password)
    user.notify_config = {
        'learn_reminder': {'enabled': True, 'timing': '1 day', 'channels': ['email']},
        'verify_reminder': {'enabled': True, 'timing': 'on due', 'channels': ['email']},
        'email': email,
        'onboarded': False,  # PR0012: 新用户引导字段
    }
    db.session.add(user)
    db.session.commit()

    token, jti, expires_at = generate_token(user.id)
    return jsonify(create_response(data={'token': token, 'user': {'id': user.id, 'username': user.username, 'email': user.email, 'points': user.points, 'is_admin': user.is_admin}})), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')

    if not all([email, password]):
        return ec.bad_request(ec.INVALID_INPUT, message='缺少必填字段')

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return ec.unauthorized(ec.INVALID_CREDENTIALS)

    token, jti, expires_at = generate_token(user.id)
    return jsonify(create_response(data={'token': token, 'user': {'id': user.id, 'username': user.username, 'email': user.email, 'points': user.points, 'is_admin': user.is_admin}}))


@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout():
    # B0230：复用 verify_token() 去重（不再直接 jwt.decode）
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return jsonify(create_response(message='Logged out successfully'))
    token = auth_header.split(' ')[1]
    payload = decode_token(token)
    if not payload:
        # token 校验失败：仍返 200（登出 idempotent）
        return jsonify(create_response(message='Logged out successfully'))

    blacklisted = TokenBlacklist(
        jti=payload['jti'],
        user_id=g.current_user.id,
        revoked_at=datetime.utcnow(),
        expires_at=datetime.fromtimestamp(payload['exp'])
    )
    db.session.add(blacklisted)
    db.session.commit()

    return jsonify(create_response(message='Logged out successfully'))


@auth_bp.route('/me', methods=['GET'])
@token_required
def get_me():
    user = g.current_user
    return jsonify(create_response(data={'user': {'id': user.id, 'username': user.username, 'email': user.email, 'points': user.points, 'is_admin': user.is_admin, 'notify_config': user.notify_config}}))


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    data = request.get_json()
    email = data.get('email')
    if not email:
        return ec.bad_request(ec.INVALID_INPUT, message='Email is required')

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify(create_response(message='If the email exists, a reset link has been sent'))

    now = datetime.utcnow()
    if user.reset_token_sent_at and (now - user.reset_token_sent_at).total_seconds() < 300:
        return jsonify(create_response(message='If the email exists, a reset link has been sent'))

    import secrets
    user.reset_token = secrets.token_hex(32)
    user.reset_token_expires_at = now + timedelta(hours=1)
    user.reset_token_sent_at = now
    db.session.commit()

    reset_link = f"{current_app.config.get('FRONTEND_URL', 'http://localhost:5173')}/reset-password?token={user.reset_token}"

    try:
        from flask_mail import Message
        from services.reminder import mail
        msg = Message(
            subject="[Zpersion] 密码重置",
            recipients=[email],
            body=f"""您好 {user.username}：

您申请了密码重置，请点击下方链接设置新密码：

{reset_link}

链接有效期：1小时
如果这不是您本人的操作，请忽略此邮件。

---
Zpersion 学习管理系统
""",
            sender=current_app.config.get('MAIL_DEFAULT_SENDER')
        )
        mail.send(msg)
    except Exception as e:
        # B0231：改用 current_app.logger
        from flask import current_app
        current_app.logger.warning(f'[Auth] Failed to send password reset email: {e}')

    return jsonify(create_response(message='If the email exists, a reset link has been sent'))


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    from datetime import timedelta
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')

    if not all([token, new_password]):
        return ec.bad_request(ec.INVALID_INPUT, message='缺少必填字段')

    user = User.query.filter_by(reset_token=token).first()
    if not user:
        return ec.bad_request(ec.RESET_TOKEN_INVALID, message='Invalid or expired token')

    if user.reset_token_expires_at < datetime.utcnow():
        return ec.bad_request(ec.RESET_TOKEN_INVALID, message='Token has expired')

    user.set_password(new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.session.commit()

    token, jti, expires_at = generate_token(user.id)
    return jsonify(create_response(message='Password reset successfully', data={'token': token}))

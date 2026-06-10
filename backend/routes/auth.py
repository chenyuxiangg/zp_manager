from flask import Blueprint, request, jsonify, g, current_app
from models import db, User, TokenBlacklist
from utils import generate_token, token_required, create_response
from datetime import datetime, timedelta

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not all([username, email, password]):
        return jsonify(create_response(success=False, error={'code': 'VALIDATION_ERROR', 'message': 'Missing required fields'})), 422

    if User.query.filter_by(email=email).first():
        return jsonify(create_response(success=False, error={'code': 'VALIDATION_ERROR', 'message': 'Email already registered'})), 422

    if User.query.filter_by(username=username).first():
        return jsonify(create_response(success=False, error={'code': 'VALIDATION_ERROR', 'message': 'Username already taken'})), 422

    user = User(username=username, email=email)
    user.set_password(password)
    user.notify_config = {
        'learn_reminder': {'enabled': True, 'timing': '1 day', 'channels': ['email']},
        'verify_reminder': {'enabled': True, 'timing': 'on due', 'channels': ['email']},
        'email': email
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
        return jsonify(create_response(success=False, error={'code': 'VALIDATION_ERROR', 'message': 'Missing required fields'})), 422

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify(create_response(success=False, error={'code': 'INVALID_CREDENTIALS', 'message': '用户名或密码不正确'})), 401

    token, jti, expires_at = generate_token(user.id)
    return jsonify(create_response(data={'token': token, 'user': {'id': user.id, 'username': user.username, 'email': user.email, 'points': user.points, 'is_admin': user.is_admin}}))


@auth_bp.route('/logout', methods=['POST'])
@token_required
def logout():
    from flask import current_app
    import jwt
    token = request.headers.get('Authorization').split(' ')[1]
    payload = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])

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
        return jsonify(create_response(success=False, error={'code': 'VALIDATION_ERROR', 'message': 'Email is required'})), 422

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
        print(f"[Auth] Failed to send password reset email: {e}")

    return jsonify(create_response(message='If the email exists, a reset link has been sent'))


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    from datetime import timedelta
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')

    if not all([token, new_password]):
        return jsonify(create_response(success=False, error={'code': 'VALIDATION_ERROR', 'message': 'Missing required fields'})), 422

    user = User.query.filter_by(reset_token=token).first()
    if not user:
        return jsonify(create_response(success=False, error={'code': 'AUTH_ERROR', 'message': 'Invalid or expired token'})), 401

    if user.reset_token_expires_at < datetime.utcnow():
        return jsonify(create_response(success=False, error={'code': 'AUTH_ERROR', 'message': 'Token has expired'})), 401

    user.set_password(new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    db.session.commit()

    token, jti, expires_at = generate_token(user.id)
    return jsonify(create_response(message='Password reset successfully', data={'token': token}))
from flask import Blueprint, request, jsonify, g
from models import db, User
from utils import token_required, create_response

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


def admin_required(f):
    """Decorator to require admin privileges"""
    from functools import wraps
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify(create_response(success=False, error={'code': 'UNAUTHORIZED', 'message': 'Missing token'})), 401

        import jwt
        from config import Config
        from models import TokenBlacklist

        try:
            payload = jwt.decode(token, Config.JWT_SECRET_KEY, algorithms=['HS256'])
            blacklisted = TokenBlacklist.query.filter_by(jti=payload['jti']).first()
            if blacklisted:
                return jsonify(create_response(success=False, error={'code': 'UNAUTHORIZED', 'message': 'Token revoked'})), 401

            from models import User
            user = User.query.get(payload['user_id'])
            if not user or not user.is_admin:
                return jsonify(create_response(success=False, error={'code': 'FORBIDDEN', 'message': 'Admin access required'})), 403

            g.current_user = user
        except jwt.ExpiredSignatureError:
            return jsonify(create_response(success=False, error={'code': 'UNAUTHORIZED', 'message': 'Token expired'})), 401
        except jwt.InvalidTokenError:
            return jsonify(create_response(success=False, error={'code': 'UNAUTHORIZED', 'message': 'Invalid token'})), 401

        return f(*args, **kwargs)
    return decorated


@admin_bp.route('/users', methods=['GET'])
@admin_required
def list_users():
    """Get all users (admin only)"""
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)

    query = User.query.order_by(User.created_at.desc())
    total = query.count()
    users = query.offset((page - 1) * limit).limit(limit).all()

    return jsonify(create_response(data={
        'users': [{'id': u.id, 'username': u.username, 'email': u.email, 'points': u.points, 'is_admin': u.is_admin, 'created_at': u.created_at.isoformat()} for u in users],
        'total': total
    }))


@admin_bp.route('/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete a user and all their data (admin only)"""
    # Prevent admin from deleting themselves
    if user_id == g.current_user.id:
        return jsonify(create_response(success=False, error={'code': 'FORBIDDEN', 'message': 'Cannot delete yourself'})), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify(create_response(success=False, error={'code': 'NOT_FOUND', 'message': 'User not found'})), 404

    db.session.delete(user)
    db.session.commit()
    return jsonify(create_response(message='User and all related data deleted'))
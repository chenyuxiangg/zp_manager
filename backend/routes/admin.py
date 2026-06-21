from flask import Blueprint, request, jsonify, g
from models import db, User
from utils import token_required, create_response
from utils import error_codes as ec  # PR0017

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


# B0232：admin_required 改用 @token_required(role='admin')，去重 jwt 逻辑
@admin_bp.route('/users', methods=['GET'])
@token_required(role='admin')
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
@token_required(role='admin')
def delete_user(user_id):
    """Delete a user and all their data (admin only)"""
    # Prevent admin from deleting themselves
    if user_id == g.current_user.id:
        return ec.forbidden(ec.NOT_ADMIN, message='Cannot delete yourself')

    user = User.query.get(user_id)
    if not user:
        return ec.not_found(ec.RESOURCE_NOT_FOUND, message='User not found')

    db.session.delete(user)
    db.session.commit()
    return jsonify(create_response(message='User and all related data deleted'))

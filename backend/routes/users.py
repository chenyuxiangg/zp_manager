from flask import Blueprint, request, jsonify, g
from models import db, User, PointLog, Task
from utils import token_required, create_response
from datetime import date

users_bp = Blueprint('users', __name__, url_prefix='/api/users')


@users_bp.route('/profile', methods=['GET'])
@token_required
def get_profile():
    user = g.current_user
    total_plans = user.plans.count()
    total_tasks = Task.query.filter_by(user_id=user.id).count()
    completed_tasks = Task.query.filter_by(user_id=user.id, status='completed').count()
    overdue_tasks = Task.query.filter(
        Task.user_id == user.id,
        Task.status.in_(['pending', 'in_progress']),
        Task.scheduled_date < date.today()
    ).count()

    return jsonify(create_response(data={
        'user': {'id': user.id, 'username': user.username, 'email': user.email, 'points': user.points, 'notify_config': user.notify_config},
        'stats': {
            'total_plans': total_plans,
            'total_tasks': total_tasks,
            'completed_tasks': completed_tasks,
            'overdue_tasks': overdue_tasks
        }
    }))


@users_bp.route('/notify-config', methods=['PUT'])
@token_required
def update_notify_config():
    data = request.get_json()
    user = g.current_user
    user.notify_config = data.get('notify_config', user.notify_config)
    db.session.commit()
    return jsonify(create_response(data={'user': {'id': user.id, 'notify_config': user.notify_config}}))


@users_bp.route('/points/history', methods=['GET'])
@token_required
def get_points_history():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)

    query = PointLog.query.filter_by(user_id=g.current_user.id).order_by(PointLog.created_at.desc())
    total = query.count()
    logs = query.offset((page - 1) * limit).limit(limit).all()

    return jsonify(create_response(data={
        'logs': [{'id': l.id, 'task_id': l.task_id, 'delta': l.delta, 'reason': l.reason, 'created_at': l.created_at.isoformat()} for l in logs],
        'total': total
    }))
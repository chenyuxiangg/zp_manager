from flask import Blueprint, request, jsonify, g
from models import db, User, PointLog, Task
from utils import token_required, create_response
from datetime import date
from services.streak import StreakService  # PR0006

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
        'user': {'id': user.id, 'username': user.username, 'email': user.email, 'points': user.points, 'is_admin': user.is_admin, 'notify_config': user.notify_config},
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
    """PR0012：浅合并 notify_config 字段，避免前端只送 onboarded 时冲掉 learn_reminder"""
    data = request.get_json()
    user = g.current_user
    incoming = data.get('notify_config')
    if incoming is None:
        # body 为空时不修改
        return jsonify(create_response(data={'user': {'id': user.id, 'notify_config': user.notify_config}}))
    # 浅合并：保留旧字段，覆盖同名字段
    current = dict(user.notify_config or {})
    current.update(incoming)
    user.notify_config = current
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


@users_bp.route('/streak', methods=['GET'])
@token_required
def get_streak():
    """PR0006 §4：返用户当前 streak / 最长 streak / 距 7 天还差 N 天 / 上次断的日期"""
    user = g.current_user
    return jsonify(create_response(data={
        'current': StreakService.current(user),
        'longest': StreakService.longest(user),
        'days_to_7': StreakService.days_to_next_milestone(user, 7),
        'days_to_30': StreakService.days_to_next_milestone(user, 30),
        'days_to_100': StreakService.days_to_next_milestone(user, 100),
        'last_broken_at': StreakService.last_broken_at(user).isoformat()
            if StreakService.last_broken_at(user) else None,
    }))
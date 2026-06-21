"""
PR0021 — Pomodoro 纯计时器路由（无积分联动）

3 个端点：
- POST /api/tasks/<id>/pomodoro/start
- POST /api/tasks/<id>/pomodoro/<session_id>/end
- GET  /api/tasks/<id>/pomodoros
"""
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, g

from models import db, Task, PomodoroSession
from utils import token_required, create_response, check_resource_permission
from utils import error_codes as ec
from services.points import PointsService  # PR0008 联动


pomodoro_bp = Blueprint('pomodoro', __name__, url_prefix='/api/tasks')
PLANNED_MINUTES = 25
# B0225 + B0164：业务限流，每小时最多 MAX_POMODOROS_PER_HOUR 个完成番茄
# 防恶意脚本借 pomodoro_auto_toggle 白名单绕过 PR0003 30min 窗口刷分
MAX_POMODOROS_PER_HOUR = 4


@pomodoro_bp.route('/<int:task_id>/pomodoro/start', methods=['POST'])
@token_required
def start_pomodoro(task_id):
    task = Task.query.get(task_id)
    err, task = check_resource_permission(task, g.current_user, resource_name='Task')
    if err:
        return err

    # 检查是否已有 active session（B0203：防双开）
    active = (
        PomodoroSession.query
        .filter_by(task_id=task_id, user_id=g.current_user.id, ended_at=None)
        .first()
    )
    if active is not None:
        return ec.conflict(
            ec.POMODORO_ALREADY_RUNNING,
            message='该任务已有专注进行中，请先结束上一个',
        )

    # B0313 修复：接受 body 的 planned_minutes 覆盖默认 25min
    # 与 PomodoroSession.planned_minutes 字段名对齐；保留向后兼容（无 body 走默认）
    body = request.get_json(silent=True) or {}
    planned_minutes = body.get('planned_minutes', PLANNED_MINUTES)
    # 校验：必须 1-180 int（防恶意值/异常导致 server DoS）
    if not isinstance(planned_minutes, int) or isinstance(planned_minutes, bool) \
            or planned_minutes < 1 or planned_minutes > 180:
        return ec.bad_request(
            ec.INVALID_INPUT,
            message='planned_minutes 必须是 1-180 之间的整数',
        )

    s = PomodoroSession(
        user_id=g.current_user.id,
        task_id=task_id,
        started_at=datetime.utcnow(),
        planned_minutes=planned_minutes,
    )
    db.session.add(s)
    db.session.commit()

    return jsonify(create_response(data={
        'session_id': s.id,
        'started_at': s.started_at.isoformat(),
        'planned_minutes': s.planned_minutes,
    })), 201


@pomodoro_bp.route('/<int:task_id>/pomodoro/<int:session_id>/end', methods=['POST'])
@token_required
def end_pomodoro(task_id, session_id):
    task = Task.query.get(task_id)
    err, task = check_resource_permission(task, g.current_user, resource_name='Task')
    if err:
        return err

    s = PomodoroSession.query.filter_by(
        id=session_id, task_id=task_id, user_id=g.current_user.id,
    ).first()
    if s is None:
        return ec.not_found(ec.RESOURCE_NOT_FOUND, message='Pomodoro session not found')
    if s.ended_at is not None:
        return ec.conflict(ec.POMODORO_ALREADY_RUNNING, message='Session already ended')

    body = request.get_json(silent=True) or {}
    early_end = body.get('early_end', False)
    auto_toggle = body.get('auto_toggle', False)

    now = datetime.utcnow()
    elapsed = (now - s.started_at).total_seconds()
    s.actual_seconds = int(elapsed)
    s.ended_at = now
    # PR0021 §7 B0211：actual_seconds >= 25*60*0.95 视为完成（25min 整也算）
    s.completed = (elapsed >= PLANNED_MINUTES * 60 * 0.95) and not early_end

    # B0225 业务限流：每小时最多 4 个完成番茄（防白名单刷分）
    if s.completed and auto_toggle:
        from datetime import timedelta
        one_hour_ago = now - timedelta(hours=1)
        recent = (
            PomodoroSession.query
            .filter(
                PomodoroSession.user_id == g.current_user.id,
                PomodoroSession.completed == True,
                PomodoroSession.ended_at >= one_hour_ago,
            )
            .count()
        )
        if recent >= MAX_POMODOROS_PER_HOUR:
            return ec.conflict(
                ec.RATE_LIMITED,
                retry_after_seconds=3600,
            )

    # PR0008 联动：25min 完成 + auto_toggle=true → 任务标 completed + 积分 +10
    # B0019：已 completed task 短路
    if s.completed and auto_toggle and task.status != 'completed':
        # 走 PointsService.award（source='pomodoro_auto_toggle' 走 rate_guard 白名单）
        on_time = task.scheduled_date >= datetime.utcnow().date()
        task.status = 'completed'
        # B0237：completed_at 与 scheduled_date 时区说明——DB 全用 server-local，
        # tz-aware 时间待 RR3 全局 timezone 改造（PR0002 已加 users.timezone 字段）
        task.completed_at = datetime.utcnow()
        PointsService.award(
            g.current_user, task,
            on_time=on_time, source='pomodoro_auto_toggle',
        )
        s.auto_toggled = True

    db.session.commit()

    return jsonify(create_response(data={
        'session': {
            'id': s.id,
            'started_at': s.started_at.isoformat(),
            'ended_at': s.ended_at.isoformat(),
            'actual_seconds': s.actual_seconds,
            'completed': s.completed,
            'auto_toggled': s.auto_toggled,
        },
    }))


@pomodoro_bp.route('/<int:task_id>/pomodoros', methods=['GET'])
@token_required
def list_pomodoros(task_id):
    task = Task.query.get(task_id)
    err, task = check_resource_permission(task, g.current_user, resource_name='Task')
    if err:
        return err

    # B0234b：分页支持，默认 limit 50
    page = request.args.get('page', 1, type=int)
    limit = min(request.args.get('limit', 50, type=int), 200)

    query = (
        PomodoroSession.query
        .filter_by(task_id=task_id, user_id=g.current_user.id)
        .order_by(PomodoroSession.started_at.desc())
    )
    total = query.count()
    sessions = query.offset((page - 1) * limit).limit(limit).all()
    return jsonify(create_response(data={
        'pomodoros': [{
            'id': s.id,
            'started_at': s.started_at.isoformat(),
            'ended_at': s.ended_at.isoformat() if s.ended_at else None,
            'planned_minutes': s.planned_minutes,
            'actual_seconds': s.actual_seconds,
            'completed': s.completed,
            'auto_toggled': s.auto_toggled,
        } for s in sessions],
        'total': total,
        'page': page,
        'limit': limit,
    }))

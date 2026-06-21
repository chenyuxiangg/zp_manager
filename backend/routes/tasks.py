from flask import Blueprint, request, jsonify, g
from models import db, Task, PointLog, User, Stage, Plan, Comment
from utils import token_required, create_response, not_found, forbidden, check_resource_permission, locked_query
from utils import error_codes as ec  # PR0017
from utils.sanitize import sanitize_html, strip_tags
from services.points import PointsService  # PR0004
from services.rate_guard import RateGuard  # PR0003
from datetime import date, datetime
from sqlalchemy.orm import joinedload

tasks_bp = Blueprint('tasks', __name__, url_prefix='/api/tasks')


@tasks_bp.route('', methods=['GET'])
@token_required
def get_tasks():
    query_date = request.args.get('date')
    tasks_query = Task.query.filter_by(user_id=g.current_user.id)

    if query_date:
        tasks_query = tasks_query.filter_by(scheduled_date=date.fromisoformat(query_date))

    tasks = tasks_query.order_by(Task.scheduled_date).all()
    return jsonify(create_response(data={'tasks': [{'id': t.id, 'stage_id': t.stage_id, 'title': t.title, 'description': t.description, 'scheduled_date': t.scheduled_date.isoformat(), 'completed_at': t.completed_at.isoformat() if t.completed_at else None, 'points': t.points, 'status': t.status} for t in tasks]}))


@tasks_bp.route('/today', methods=['GET'])
@token_required
def get_today_tasks():
    today = date.today()
    tasks = Task.query.filter_by(user_id=g.current_user.id, scheduled_date=today).all()
    return jsonify(create_response(data={'tasks': [{'id': t.id, 'stage_id': t.stage_id, 'title': t.title, 'description': t.description, 'scheduled_date': t.scheduled_date.isoformat(), 'completed_at': t.completed_at.isoformat() if t.completed_at else None, 'points': t.points, 'status': t.status} for t in tasks]}))


@tasks_bp.route('/overdue', methods=['GET'])
@token_required
def get_overdue_tasks():
    today = date.today()
    tasks = Task.query.filter(
        Task.user_id == g.current_user.id,
        Task.status.in_(['pending', 'in_progress']),
        Task.scheduled_date < today
    ).all()
    return jsonify(create_response(data={'tasks': [{'id': t.id, 'stage_id': t.stage_id, 'title': t.title, 'description': t.description, 'scheduled_date': t.scheduled_date.isoformat(), 'points': t.points, 'status': t.status} for t in tasks]}))


@tasks_bp.route('/<int:task_id>', methods=['GET'])
@token_required
def get_task(task_id):
    """任务详情（含 stage/plan join，避免 N+1）"""
    task = Task.query.options(
        joinedload(Task.stage).joinedload(Stage.plan)
    ).filter_by(id=task_id).first()

    err, task = check_resource_permission(task, g.current_user, resource_name='Task')
    if err:
        return err

    return jsonify(create_response(data={'task': {
        'id': task.id,
        'stage_id': task.stage_id,
        'title': task.title,
        'description': task.description,
        'scheduled_date': task.scheduled_date.isoformat(),
        'completed_at': task.completed_at.isoformat() if task.completed_at else None,
        'points': task.points,
        'status': task.status,
        'stage': {
            'id': task.stage.id,
            'title': task.stage.title,
            'plan_id': task.stage.plan_id,
        } if task.stage else None,
        'plan': {
            'id': task.stage.plan.id,
            'title': task.stage.plan.title,
        } if task.stage and task.stage.plan else None,
    }}))


@tasks_bp.route('/<int:task_id>', methods=['PUT'])
@token_required
def update_task(task_id):
    task = Task.query.filter_by(id=task_id).first()
    err, task = check_resource_permission(task, g.current_user, resource_name='Task')
    if err:
        return err

    data = request.get_json()
    if 'title' in data:
        # 标题清洗：剥除所有 HTML 标签（XSS 防护）
        cleaned_title = strip_tags(data['title'])
        if not cleaned_title:
            return ec.bad_request(ec.INVALID_INPUT, message='Title cannot be empty')
        task.title = cleaned_title
    if 'description' in data:
        task.description = sanitize_html(data['description'])
    if 'scheduled_date' in data:
        task.scheduled_date = date.fromisoformat(data['scheduled_date'])
    if 'status' in data:
        task.status = data['status']

    db.session.commit()
    return jsonify(create_response(data={'task': {'id': task.id, 'title': task.title, 'description': task.description, 'scheduled_date': task.scheduled_date.isoformat(), 'status': task.status}}))


@tasks_bp.route('/<int:task_id>/complete', methods=['PUT'])
@token_required
def complete_task(task_id):
    task = Task.query.filter_by(id=task_id).first()
    err, task = check_resource_permission(task, g.current_user, resource_name='Task')
    if err:
        return err

    if task.status == 'completed':
        return jsonify(create_response(data={'task': {'id': task.id, 'status': task.status}, 'points_delta': 0}, message='Task already completed'))

    is_on_time = task.scheduled_date >= date.today()
    task.status = 'completed'
    task.completed_at = datetime.utcnow()

    # PR0004：所有积分数学走 PointsService
    log = PointsService.award(g.current_user, task, on_time=is_on_time)
    db.session.commit()

    return jsonify(create_response(data={'task': {'id': task.id, 'status': task.status, 'completed_at': task.completed_at.isoformat()}, 'points_delta': log.delta}))


@tasks_bp.route('/<int:task_id>', methods=['DELETE'])
@token_required
def delete_task(task_id):
    task = Task.query.filter_by(id=task_id).first()
    err, task = check_resource_permission(task, g.current_user, resource_name='Task')
    if err:
        return err

    # PR0016：完成态 task 不可删（D3 强化 + 防止悬空 PointLog）
    if task.status == 'completed':
        return ec.conflict(ec.TASK_ALREADY_COMPLETED, message='已完成任务不可删除，请先撤销完成')

    db.session.delete(task)
    db.session.commit()
    return jsonify(create_response(message='Task deleted successfully'))


@tasks_bp.route('/<int:task_id>/toggle', methods=['PATCH'])
@token_required
def toggle_task(task_id):
    """切换任务完成状态（含积分回滚 + 行锁）
    D1: 撤销完成会回滚已奖励积分
    D2: 撤销后 status 回到 'pending'
    行锁：防止并发 toggle 导致双倍扣分（生产 MySQL/PostgreSQL）
    PR0003：30 分钟反刷分窗口守卫（不论 toggle 方向，PR0003 §6 要求）
    PR0004：所有积分数学走 PointsService
    B0331：rate_guard 调用前移到 toggle 入口，覆盖 completed→pending 撤销分支
    """
    # 行锁查询（SQLite 测试环境不生效，生产 MySQL 生效）
    task = locked_query(Task.query.filter_by(id=task_id)).first()
    err, task = check_resource_permission(task, g.current_user, resource_name='Task')
    if err:
        return err

    points_delta = 0
    user = g.current_user

    # B0331：PR0003 §6 明确要求"已 completed task 在 30 分钟内被 toggle 撤销仍走本守卫"。
    # 把 rate_guard 调用从 pending→completed 分支前移到 toggle 入口前置，覆盖
    # completed→pending→completed 循环刷分攻击。
    body = request.get_json(silent=True) or {}
    source = body.get('source', 'manual')
    allowed, retry_after = RateGuard.can_toggle(user.id, task.id, source=source)
    if not allowed:
        return ec.conflict(ec.RATE_LIMITED, retry_after_seconds=retry_after)

    if task.status == 'completed':
        # 撤销完成：回滚最近一次 award 积分
        # 同样使用行锁查询 PointLog，防止并发读脏数据
        last_log = locked_query(PointLog.query.filter_by(
            task_id=task.id, operation='award'
        ).order_by(PointLog.id.desc())).first()

        if last_log:
            refund_log = PointsService.refund(user, task, last_log)
            points_delta = refund_log.delta  # 负值

        task.status = 'pending'
        task.completed_at = None
    else:
        # pending / in_progress → completed
        # rate_guard 已在外层调用，此处仅处理积分奖励
        is_on_time = task.scheduled_date >= date.today()
        task.status = 'completed'
        task.completed_at = datetime.utcnow()

        log = PointsService.award(user, task, on_time=is_on_time, source=source)
        points_delta = log.delta

    db.session.commit()

    # B0221 + B0188 sync fallback：toggle 后同 worker 立即调
    # StreakService.record_completion（兜底 outbox consumer 30s 延迟；
    # 跨 worker 时 sync 路径无效，consumer worker 30s 内补上）
    if task.status == 'completed':
        try:
            from services.streak import StreakService
            from datetime import date as date_cls
            StreakService.record_completion(user.id, date_cls.today())
        except Exception:
            # sync fallback 失败不影响主流程（outbox consumer 兜底）
            pass

    return jsonify(create_response(data={
        'task': {
            'id': task.id,
            'stage_id': task.stage_id,
            'title': task.title,
            'description': task.description,
            'scheduled_date': task.scheduled_date.isoformat(),
            'completed_at': task.completed_at.isoformat() if task.completed_at else None,
            'points': task.points,
            'status': task.status,
        },
        'points_delta': points_delta,
    }))


@tasks_bp.route('/<int:task_id>/comments', methods=['GET'])
@token_required
def get_comments(task_id):
    task = Task.query.filter_by(id=task_id).first()
    err, task = check_resource_permission(task, g.current_user, resource_name='Task')
    if err:
        return err

    comments = task.comments.all()
    return jsonify(create_response(data={'comments': [{
        'id': c.id,
        'user_id': c.user_id,
        'username': c.author.username if c.author else None,
        'content': c.content,
        'created_at': c.created_at.isoformat(),
        'updated_at': c.updated_at.isoformat() if c.updated_at else None,
    } for c in comments]}))


@tasks_bp.route('/<int:task_id>/comments', methods=['POST'])
@token_required
def add_comment(task_id):
    task = Task.query.filter_by(id=task_id).first()
    err, task = check_resource_permission(task, g.current_user, resource_name='Task')
    if err:
        return err

    data = request.get_json()
    content = data.get('content')
    if not content:
        return ec.bad_request(ec.INVALID_INPUT, message='Content is required')

    content = sanitize_html(content)
    comment = Comment(task_id=task_id, user_id=g.current_user.id, content=content)
    db.session.add(comment)
    # flush 让 comment.id 生成，再交给 PointsService（related_comment_id 需要）
    db.session.flush()

    # PR0004：所有积分数学走 PointsService
    PointsService.award_comment(g.current_user, task, comment_id=comment.id)

    db.session.commit()
    # 重新查询以确保 author 关系可用
    db.session.refresh(comment)
    return jsonify(create_response(data={'comment': {
        'id': comment.id,
        'user_id': comment.user_id,
        'username': comment.author.username if comment.author else None,
        'content': comment.content,
        'created_at': comment.created_at.isoformat(),
        'updated_at': comment.updated_at.isoformat() if comment.updated_at else None,
    }}, message='Comment added')), 201


@tasks_bp.route('/<int:task_id>/comments/<int:comment_id>', methods=['PUT'])
@token_required
def update_comment(task_id, comment_id):
    # 先校验 task 权限
    task = Task.query.filter_by(id=task_id).first()
    err, _ = check_resource_permission(task, g.current_user, resource_name='Task')
    if err:
        return err

    # D7: 评论先按 id 查，再校验权限
    comment = Comment.query.filter_by(id=comment_id, task_id=task_id).first()
    if not comment:
        return ec.not_found(ec.RESOURCE_NOT_FOUND, message='Comment not found')
    if comment.user_id != g.current_user.id:
        return ec.forbidden(ec.NOT_OWNER, message='You can only edit your own comments')

    data = request.get_json()
    content = data.get('content')
    if not content:
        return ec.bad_request(ec.INVALID_INPUT, message='Content is required')

    comment.content = sanitize_html(content)
    db.session.commit()
    db.session.refresh(comment)
    return jsonify(create_response(data={'comment': {
        'id': comment.id,
        'user_id': comment.user_id,
        'username': comment.author.username if comment.author else None,
        'content': comment.content,
        'created_at': comment.created_at.isoformat(),
        'updated_at': comment.updated_at.isoformat() if comment.updated_at else None,
    }}, message='Comment updated'))


@tasks_bp.route('/<int:task_id>/comments/<int:comment_id>', methods=['DELETE'])
@token_required
def delete_comment(task_id, comment_id):
    # 先校验 task 权限
    task = Task.query.filter_by(id=task_id).first()
    err, _ = check_resource_permission(task, g.current_user, resource_name='Task')
    if err:
        return err

    # D7: 评论先按 id 查，再校验权限
    comment = Comment.query.filter_by(id=comment_id, task_id=task_id).first()
    if not comment:
        return ec.not_found(ec.RESOURCE_NOT_FOUND, message='Comment not found')
    if comment.user_id != g.current_user.id:
        return ec.forbidden(ec.NOT_OWNER, message='You can only delete your own comments')

    # PR0015：先积分对冲，再删 comment（避免悬空 related_comment_id）
    PointsService.refund_comment(g.current_user, task, comment_id=comment.id)

    db.session.delete(comment)
    db.session.commit()
    return jsonify(create_response(message='Comment deleted'))
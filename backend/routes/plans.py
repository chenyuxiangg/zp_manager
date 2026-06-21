from flask import Blueprint, request, jsonify, g
from models import db, Plan, Stage, Task
from utils import token_required, create_response, check_resource_permission
from utils import error_codes as ec  # PR0017
from utils.sanitize import sanitize_html, strip_tags

plans_bp = Blueprint('plans', __name__, url_prefix='/api/plans')


@plans_bp.route('', methods=['GET'])
@token_required
def get_plans():
    plans = Plan.query.filter_by(user_id=g.current_user.id).order_by(Plan.created_at.desc()).all()
    return jsonify(create_response(data={'plans': [{'id': p.id, 'title': p.title, 'description': p.description, 'start_date': p.start_date.isoformat(), 'end_date': p.end_date.isoformat(), 'status': p.status, 'created_at': p.created_at.isoformat()} for p in plans]}))


@plans_bp.route('', methods=['POST'])
@token_required
def create_plan():
    data = request.get_json()
    title = data.get('title')
    description = data.get('description')
    start_date = data.get('start_date')
    end_date = data.get('end_date')

    if not all([title, start_date, end_date]):
        return ec.bad_request(ec.INVALID_INPUT, message='缺少必填字段')

    # 标题清洗：剥除 HTML 标签（XSS 防护）
    title = strip_tags(title)
    if not title:
        return ec.bad_request(ec.INVALID_INPUT, message='计划名称不能为空')

    existing = Plan.query.filter_by(user_id=g.current_user.id, title=title).first()
    if existing:
        return ec.conflict(ec.TITLE_DUPLICATED, message='计划名称已存在')

    from datetime import date
    plan = Plan(
        user_id=g.current_user.id,
        title=title,
        description=sanitize_html(description),
        start_date=date.fromisoformat(start_date),
        end_date=date.fromisoformat(end_date)
    )
    db.session.add(plan)
    db.session.commit()

    return jsonify(create_response(data={'plan': {'id': plan.id, 'title': plan.title, 'description': plan.description, 'start_date': plan.start_date.isoformat(), 'end_date': plan.end_date.isoformat(), 'status': plan.status}}, message='Plan created successfully')), 201


@plans_bp.route('/<int:plan_id>', methods=['GET'])
@token_required
def get_plan(plan_id):
    plan = Plan.query.filter_by(id=plan_id).first()
    err, plan = check_resource_permission(plan, g.current_user, resource_name='Plan')
    if err:
        return err

    stages = Stage.query.filter_by(plan_id=plan_id).order_by(Stage.order_num).all()
    tasks = Task.query.filter(Task.stage_id.in_([s.id for s in stages])).all() if stages else []

    return jsonify(create_response(data={
        'plan': {'id': plan.id, 'title': plan.title, 'description': plan.description, 'start_date': plan.start_date.isoformat(), 'end_date': plan.end_date.isoformat(), 'status': plan.status},
        'stages': [{'id': s.id, 'title': s.title, 'description': s.description, 'order_num': s.order_num, 'start_date': s.start_date.isoformat(), 'end_date': s.end_date.isoformat(), 'status': s.status} for s in stages],
        'tasks': [{'id': t.id, 'stage_id': t.stage_id, 'title': t.title, 'description': t.description, 'scheduled_date': t.scheduled_date.isoformat(), 'completed_at': t.completed_at.isoformat() if t.completed_at else None, 'points': t.points, 'status': t.status} for t in tasks]
    }))


@plans_bp.route('/<int:plan_id>', methods=['PUT'])
@token_required
def update_plan(plan_id):
    plan = Plan.query.filter_by(id=plan_id).first()
    err, plan = check_resource_permission(plan, g.current_user, resource_name='Plan')
    if err:
        return err

    data = request.get_json()
    if 'title' in data:
        cleaned_title = strip_tags(data['title'])
        if not cleaned_title:
            return ec.bad_request(ec.INVALID_INPUT, message='Title cannot be empty')
        plan.title = cleaned_title
    if 'description' in data:
        plan.description = sanitize_html(data['description'])
    if 'status' in data:
        new_status = data['status']
        if new_status == 'archived':
            stages = Stage.query.filter_by(plan_id=plan_id).all()
            has_pending = any(s.status != 'completed' for s in stages)
            if has_pending:
                return ec.conflict(ec.PLAN_NOT_ARCHIVABLE, message='计划下还有未完成的阶段，无法归档')
        plan.status = new_status

    db.session.commit()
    return jsonify(create_response(data={'plan': {'id': plan.id, 'title': plan.title, 'description': plan.description, 'status': plan.status}}))


@plans_bp.route('/<int:plan_id>', methods=['DELETE'])
@token_required
def delete_plan(plan_id):
    plan = Plan.query.filter_by(id=plan_id).first()
    err, plan = check_resource_permission(plan, g.current_user, resource_name='Plan')
    if err:
        return err

    # B0234：用 .has() 关联查询，避免懒加载 plan.stages
    has_completed = Task.query.filter(
        Task.stage.has(plan_id=plan.id),
        Task.status == 'completed',
    ).first() is not None
    if has_completed:
        return ec.conflict(ec.PLAN_HAS_COMPLETED_TASKS, message='计划下存在已完成的任务，无法删除')

    db.session.delete(plan)
    db.session.commit()
    return jsonify(create_response(message='Plan deleted successfully'))


@plans_bp.route('/<int:plan_id>/stages', methods=['POST'])
@token_required
def create_stage(plan_id):
    plan = Plan.query.filter_by(id=plan_id, user_id=g.current_user.id).first()
    if not plan:
        return ec.not_found(ec.RESOURCE_NOT_FOUND, message='Plan not found')

    data = request.get_json()
    title = data.get('title')

    # 标题清洗
    title = strip_tags(title) if title else None
    if not title:
        return ec.bad_request(ec.INVALID_INPUT, message='阶段名称不能为空')

    existing = Stage.query.filter_by(plan_id=plan_id, title=title).first()
    if existing:
        return ec.conflict(ec.TITLE_DUPLICATED, message='阶段名称已存在')

    from datetime import date
    stage_start = date.fromisoformat(data['start_date'])
    stage_end = date.fromisoformat(data['end_date'])

    if stage_start < plan.start_date or stage_end > plan.end_date:
        return ec.bad_request(ec.INVALID_INPUT, message='阶段时间必须在计划时间范围内')

    stage = Stage(
        plan_id=plan_id,
        title=title,
        description=sanitize_html(data.get('description')),
        order_num=data.get('order_num', 0),
        start_date=stage_start,
        end_date=stage_end
    )
    db.session.add(stage)
    db.session.commit()

    return jsonify(create_response(data={'stage': {'id': stage.id, 'title': stage.title, 'description': stage.description, 'order_num': stage.order_num, 'status': stage.status}}, message='Stage created successfully')), 201

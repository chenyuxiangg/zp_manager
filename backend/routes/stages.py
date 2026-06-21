from flask import Blueprint, request, jsonify, g
from models import db, Stage, Task
from utils import token_required, create_response, check_resource_permission
from utils import error_codes as ec  # PR0017
from utils.sanitize import sanitize_html, strip_tags

stages_bp = Blueprint('stages', __name__, url_prefix='/api/stages')


@stages_bp.route('/<int:stage_id>', methods=['PUT'])
@token_required
def update_stage(stage_id):
    stage = Stage.query.get(stage_id)
    err, stage = check_resource_permission(stage, g.current_user, resource_name='Stage')
    if err:
        return err

    data = request.get_json()
    if 'title' in data:
        cleaned_title = strip_tags(data['title'])
        if not cleaned_title:
            return ec.bad_request(ec.INVALID_INPUT, message='Title cannot be empty')
        stage.title = cleaned_title
    if 'description' in data:
        stage.description = sanitize_html(data['description'])
    if 'status' in data:
        new_status = data['status']
        if new_status == 'completed':
            has_incomplete = Task.query.filter_by(stage_id=stage_id).filter(Task.status != 'completed').count() > 0
            if has_incomplete:
                return ec.conflict(ec.STAGE_NOT_COMPLETABLE, message='阶段下还有未完成的任务，无法标记为已完成')
        stage.status = new_status
    if 'order_num' in data:
        stage.order_num = data['order_num']

    db.session.commit()
    return jsonify(create_response(data={'stage': {'id': stage.id, 'title': stage.title, 'description': stage.description, 'order_num': stage.order_num, 'status': stage.status}}))


@stages_bp.route('/<int:stage_id>', methods=['DELETE'])
@token_required
def delete_stage(stage_id):
    stage = Stage.query.get(stage_id)
    err, stage = check_resource_permission(stage, g.current_user, resource_name='Stage')
    if err:
        return err

    db.session.delete(stage)
    db.session.commit()
    return jsonify(create_response(message='Stage deleted successfully'))


@stages_bp.route('/<int:stage_id>/tasks', methods=['POST'])
@token_required
def create_task(stage_id):
    stage = Stage.query.get(stage_id)
    err, stage = check_resource_permission(stage, g.current_user, resource_name='Stage')
    if err:
        return err

    data = request.get_json()
    title = data.get('title')

    # 标题清洗
    title = strip_tags(title) if title else None
    if not title:
        return ec.bad_request(ec.INVALID_INPUT, message='任务名称不能为空')

    existing = Task.query.filter_by(stage_id=stage_id, title=title).first()
    if existing:
        return ec.conflict(ec.TITLE_DUPLICATED, message='任务名称已存在')

    from datetime import date
    task_date = date.fromisoformat(data['scheduled_date'])

    if task_date < stage.start_date or task_date > stage.end_date:
        return ec.bad_request(ec.INVALID_INPUT, message='任务时间必须在阶段时间范围内')

    task = Task(
        user_id=g.current_user.id,
        stage_id=stage_id,
        title=title,
        description=sanitize_html(data.get('description')),
        scheduled_date=task_date,
        points=data.get('points', 10)
    )
    db.session.add(task)
    db.session.commit()

    return jsonify(create_response(data={'task': {'id': task.id, 'title': task.title, 'description': task.description, 'scheduled_date': task.scheduled_date.isoformat(), 'points': task.points, 'status': task.status}}, message='Task created successfully')), 201

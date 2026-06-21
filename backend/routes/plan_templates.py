from flask import Blueprint, request, jsonify, g
from models import db, PlanTemplate, TemplateStage, TemplateTask, Plan, Stage, Task
from utils import token_required, create_response
from utils import error_codes as ec  # PR0017
from datetime import date, timedelta

templates_bp = Blueprint('templates', __name__, url_prefix='/api/plan-templates')


@templates_bp.route('', methods=['GET'])
@token_required
def get_templates():
    templates = PlanTemplate.query.filter(
        (PlanTemplate.user_id == g.current_user.id) | (PlanTemplate.user_id == 0) | (PlanTemplate.user_id.is_(None))
    ).order_by(PlanTemplate.created_at.desc()).all()
    return jsonify(create_response(data={'templates': [{
        'id': t.id,
        'title': t.title,
        'description': t.description,
        'user_id': t.user_id,
        'created_at': t.created_at.isoformat()
    } for t in templates]}))


@templates_bp.route('/<int:template_id>', methods=['GET'])
@token_required
def get_template(template_id):
    template = PlanTemplate.query.filter(
        PlanTemplate.id == template_id,
        (PlanTemplate.user_id == g.current_user.id) | (PlanTemplate.user_id == 0) | (PlanTemplate.user_id.is_(None))
    ).first()
    if not template:
        return ec.not_found(ec.RESOURCE_NOT_FOUND, message='Template not found')

    stages = TemplateStage.query.filter_by(template_id=template_id).order_by(TemplateStage.order_num).all()
    return jsonify(create_response(data={'template': {
        'id': template.id,
        'title': template.title,
        'description': template.description,
        'stages': [{
            'id': s.id,
            'title': s.title,
            'description': s.description,
            'order_num': s.order_num,
            'start_day': s.start_day,
            'end_day': s.end_day,
            'tasks': [{
                'id': t.id,
                'title': t.title,
                'description': t.description,
                'points': t.points,
                'day_offset': t.day_offset
            } for t in s.tasks]
        } for s in stages]
    }}))


@templates_bp.route('', methods=['POST'])
@token_required
def create_template():
    """从计划导出为模板，或直接创建模板"""
    data = request.get_json()
    plan_id = data.get('plan_id')

    if plan_id:
        plan = Plan.query.filter_by(id=plan_id, user_id=g.current_user.id).first()
        if not plan:
            return ec.not_found(ec.RESOURCE_NOT_FOUND, message='Plan not found')

        template = PlanTemplate(
            user_id=g.current_user.id,
            title=plan.title,
            description=plan.description
        )
        db.session.add(template)
        db.session.flush()

        for stage in plan.stages.order_by(Stage.order_num).all():
            stage_duration = (stage.end_date - stage.start_date).days + 1
            stage_start = (stage.start_date - plan.start_date).days

            template_stage = TemplateStage(
                template_id=template.id,
                title=stage.title,
                description=stage.description,
                order_num=stage.order_num,
                start_day=stage_start,
                end_day=stage_start + stage_duration - 1
            )
            db.session.add(template_stage)
            db.session.flush()

            for task in stage.tasks.all():
                task_offset = (task.scheduled_date - plan.start_date).days
                template_task = TemplateTask(
                    stage_id=template_stage.id,
                    title=task.title,
                    description=task.description,
                    points=task.points,
                    day_offset=task_offset
                )
                db.session.add(template_task)
    else:
        title = data.get('title')
        description = data.get('description')
        stages_data = data.get('stages', [])

        if not title:
            return ec.bad_request(ec.INVALID_INPUT, message='Title is required')

        template = PlanTemplate(
            user_id=g.current_user.id,
            title=title,
            description=description
        )
        db.session.add(template)
        db.session.flush()

        for idx, s in enumerate(stages_data):
            template_stage = TemplateStage(
                template_id=template.id,
                title=s.get('title'),
                description=s.get('description', ''),
                order_num=s.get('order_num', idx),
                start_day=s.get('start_day', 0),
                end_day=s.get('end_day', 7)
            )
            db.session.add(template_stage)
            db.session.flush()

            for t_idx, t in enumerate(s.get('tasks', [])):
                template_task = TemplateTask(
                    stage_id=template_stage.id,
                    title=t.get('title'),
                    description=t.get('description', ''),
                    points=t.get('points', 10),
                    day_offset=t.get('day_offset', t_idx)
                )
                db.session.add(template_task)

    db.session.commit()
    return jsonify(create_response(data={'template': {'id': template.id, 'title': template.title}}, message='Template created successfully')), 201


@templates_bp.route('/<int:template_id>', methods=['DELETE'])
@token_required
def delete_template(template_id):
    template = PlanTemplate.query.filter_by(id=template_id, user_id=g.current_user.id).first()
    if not template:
        return ec.not_found(ec.RESOURCE_NOT_FOUND, message='Template not found')

    db.session.delete(template)
    db.session.commit()
    return jsonify(create_response(message='Template deleted successfully'))


@templates_bp.route('/import', methods=['POST'])
@token_required
def import_plan_template():
    """从上传的JSON文件直接导入学习计划"""
    if 'file' not in request.files:
        return ec.bad_request(ec.INVALID_INPUT, message='请选择要上传的文件')

    file = request.files['file']
    if file.filename == '':
        return ec.bad_request(ec.INVALID_INPUT, message='文件名不能为空')

    if not file.filename.endswith('.json'):
        return ec.bad_request(ec.INVALID_INPUT, message='只支持JSON文件格式')

    try:
        import json
        data = json.load(file)

        title = data.get('title')
        description = data.get('description', '')
        stages_data = data.get('stages', [])

        if not title:
            return ec.bad_request(ec.INVALID_INPUT, message='计划标题不能为空')

        if not stages_data:
            return ec.bad_request(ec.INVALID_INPUT, message='计划中至少需要有一个阶段')

        start_date = date.today()
        max_end_day = max((s.get('end_day', 6) for s in stages_data), default=6)
        end_date = start_date + timedelta(days=max_end_day)

        existing = Plan.query.filter_by(user_id=g.current_user.id, title=title).first()
        if existing:
            return ec.conflict(ec.TITLE_DUPLICATED, message='计划名称已存在')

        plan = Plan(
            user_id=g.current_user.id,
            title=title,
            description=description,
            start_date=start_date,
            end_date=end_date
        )
        db.session.add(plan)
        db.session.flush()

        for idx, s in enumerate(stages_data):
            stage_start = start_date + timedelta(days=s.get('start_day', idx * 7))
            stage_end = start_date + timedelta(days=s.get('end_day', (idx + 1) * 7 - 1))

            stage = Stage(
                plan_id=plan.id,
                title=s.get('title', f'阶段{idx + 1}'),
                description=s.get('description', ''),
                order_num=s.get('order_num', idx),
                start_date=stage_start,
                end_date=stage_end
            )
            db.session.add(stage)
            db.session.flush()

            for t_idx, t in enumerate(s.get('tasks', [])):
                day_offset = t.get('day_offset', t_idx)
                task_date = start_date + timedelta(days=day_offset)
                task = Task(
                    user_id=g.current_user.id,
                    stage_id=stage.id,
                    title=t.get('title', f'任务{t_idx + 1}'),
                    description=t.get('description', ''),
                    scheduled_date=task_date,
                    points=t.get('points', 10)
                )
                db.session.add(task)

        db.session.commit()
        response = jsonify(create_response(data={'plan': {'id': plan.id, 'title': plan.title}}, message='计划导入成功'))
        response.status_code = 201
        return response

    except json.JSONDecodeError:
        return ec.bad_request(ec.INVALID_INPUT, message='JSON文件格式错误')
    except Exception as e:
        db.session.rollback()
        return ec.server_error(ec.INTERNAL_ERROR, message=f'导入失败: {str(e)}')


@templates_bp.route('/from-template', methods=['POST'])
@token_required
def create_plan_from_template():
    """从模板创建计划"""
    data = request.get_json()
    template_id = data.get('template_id')
    start_date_str = data.get('start_date')

    if not template_id or not start_date_str:
        return ec.bad_request(ec.INVALID_INPUT, message='template_id and start_date are required')

    template = PlanTemplate.query.filter(
        PlanTemplate.id == template_id,
        (PlanTemplate.user_id == g.current_user.id) | (PlanTemplate.user_id == 0) | (PlanTemplate.user_id.is_(None))
    ).first()
    if not template:
        return ec.not_found(ec.RESOURCE_NOT_FOUND, message='Template not found')

    start_date = date.fromisoformat(start_date_str)
    stages = TemplateStage.query.filter_by(template_id=template_id).order_by(TemplateStage.order_num).all()

    if not stages:
        return ec.bad_request(ec.INVALID_INPUT, message='Template has no stages')

    existing = Plan.query.filter_by(user_id=g.current_user.id, title=template.title).first()
    if existing:
        return ec.conflict(ec.TITLE_DUPLICATED, message='计划名称已存在')

    max_end_day = max(s.end_day for s in stages)
    end_date = start_date + timedelta(days=max_end_day)

    plan = Plan(
        user_id=g.current_user.id,
        title=template.title,
        description=template.description,
        start_date=start_date,
        end_date=end_date
    )
    db.session.add(plan)
    db.session.flush()

    for stage in stages:
        stage_start = start_date + timedelta(days=stage.start_day)
        stage_end = start_date + timedelta(days=stage.end_day)

        new_stage = Stage(
            plan_id=plan.id,
            title=stage.title,
            description=stage.description,
            order_num=stage.order_num,
            start_date=stage_start,
            end_date=stage_end
        )
        db.session.add(new_stage)
        db.session.flush()

        for task in stage.tasks.all():
            task_date = start_date + timedelta(days=task.day_offset)
            new_task = Task(
                user_id=g.current_user.id,
                stage_id=new_stage.id,
                title=task.title,
                description=task.description,
                scheduled_date=task_date,
                points=task.points
            )
            db.session.add(new_task)

    db.session.commit()
    return jsonify(create_response(data={'plan': {'id': plan.id, 'title': plan.title}}, message='Plan created from template')), 201
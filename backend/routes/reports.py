from flask import Blueprint, request, jsonify, g
from models import db, Report, Task, PointLog
from utils import token_required, create_response
from datetime import date, datetime, timedelta
from calendar import monthrange
from dateutil.parser import parse as parse_date

reports_bp = Blueprint('reports', __name__, url_prefix='/api/reports')


def get_week_range(d):
    start = d - timedelta(days=d.weekday())
    end = start + timedelta(days=6)
    return start, end


@reports_bp.route('/weekly', methods=['GET'])
@token_required
def get_weekly_report():
    param_date = request.args.get('date')
    if param_date:
        target = parse_date(param_date).date()
    else:
        target = date.today()

    start_date, end_date = get_week_range(target)

    tasks = Task.query.filter(
        Task.user_id == g.current_user.id,
        Task.scheduled_date >= start_date,
        Task.scheduled_date <= end_date
    ).all()

    completed = [t for t in tasks if t.status == 'completed']
    overdue = [t for t in tasks if t.status in ['pending', 'in_progress'] and t.scheduled_date < date.today()]

    earned = PointLog.query.filter(
        PointLog.user_id == g.current_user.id,
        PointLog.created_at >= datetime.combine(start_date, datetime.min.time()),
        PointLog.created_at <= datetime.combine(end_date, datetime.max.time()),
        PointLog.delta > 0
    ).all()

    spent = PointLog.query.filter(
        PointLog.user_id == g.current_user.id,
        PointLog.created_at >= datetime.combine(start_date, datetime.min.time()),
        PointLog.created_at <= datetime.combine(end_date, datetime.max.time()),
        PointLog.delta < 0
    ).all()

    content = {
        'period': f'{target.year}-W{target.isocalendar()[1]}',
        'period_start': start_date.isoformat(),
        'period_end': end_date.isoformat(),
        'summary': {
            'total_tasks': len(tasks),
            'completed_tasks': len(completed),
            'completion_rate': round(len(completed) / len(tasks), 2) if tasks else 0,
            'points_earned': sum(p.delta for p in earned),
            'points_spent': sum(abs(p.delta) for p in spent)
        },
        'completed_tasks': [{'id': t.id, 'title': t.title, 'scheduled_date': t.scheduled_date.isoformat()} for t in completed],
        'overdue_tasks': [{'id': t.id, 'title': t.title, 'scheduled_date': t.scheduled_date.isoformat()} for t in overdue],
        'upcoming_tasks': [{'id': t.id, 'title': t.title, 'scheduled_date': t.scheduled_date.isoformat()} for t in tasks if t.status not in ['completed', 'overdue'] and t.scheduled_date >= date.today()],
        'comment_count': sum(1 for p in earned if p.reason == 'comment_added')
    }

    report = Report(user_id=g.current_user.id, type='weekly', period_start=start_date, period_end=end_date, content=content)
    db.session.add(report)
    db.session.commit()

    return jsonify(create_response(data={'report': content}))


@reports_bp.route('/monthly', methods=['GET'])
@token_required
def get_monthly_report():
    param_date = request.args.get('date')
    if param_date:
        target = parse_date(param_date).date()
    else:
        target = date.today()

    start_date = date(target.year, target.month, 1)
    _, last_day = monthrange(target.year, target.month)
    end_date = date(target.year, target.month, last_day)

    tasks = Task.query.filter(
        Task.user_id == g.current_user.id,
        Task.scheduled_date >= start_date,
        Task.scheduled_date <= end_date
    ).all()

    completed = [t for t in tasks if t.status == 'completed']
    overdue = [t for t in tasks if t.status in ['pending', 'in_progress'] and t.scheduled_date < date.today()]

    earned = PointLog.query.filter(
        PointLog.user_id == g.current_user.id,
        PointLog.created_at >= datetime.combine(start_date, datetime.min.time()),
        PointLog.created_at <= datetime.combine(end_date, datetime.max.time()),
        PointLog.delta > 0
    ).all()

    spent = PointLog.query.filter(
        PointLog.user_id == g.current_user.id,
        PointLog.created_at >= datetime.combine(start_date, datetime.min.time()),
        PointLog.created_at <= datetime.combine(end_date, datetime.max.time()),
        PointLog.delta < 0
    ).all()

    content = {
        'period': f'{target.year}-{target.month:02d}',
        'period_start': start_date.isoformat(),
        'period_end': end_date.isoformat(),
        'summary': {
            'total_tasks': len(tasks),
            'completed_tasks': len(completed),
            'completion_rate': round(len(completed) / len(tasks), 2) if tasks else 0,
            'points_earned': sum(p.delta for p in earned),
            'points_spent': sum(abs(p.delta) for p in spent)
        },
        'completed_tasks': [{'id': t.id, 'title': t.title, 'scheduled_date': t.scheduled_date.isoformat()} for t in completed],
        'overdue_tasks': [{'id': t.id, 'title': t.title, 'scheduled_date': t.scheduled_date.isoformat()} for t in overdue],
        'upcoming_tasks': [{'id': t.id, 'title': t.title, 'scheduled_date': t.scheduled_date.isoformat()} for t in tasks if t.status not in ['completed', 'overdue'] and t.scheduled_date >= date.today()],
        'comment_count': sum(1 for p in earned if p.reason == 'comment_added')
    }

    report = Report(user_id=g.current_user.id, type='monthly', period_start=start_date, period_end=end_date, content=content)
    db.session.add(report)
    db.session.commit()

    return jsonify(create_response(data={'report': content}))


@reports_bp.route('/yearly', methods=['GET'])
@token_required
def get_yearly_report():
    param_year = request.args.get('year', type=int)
    year = param_year or date.today().year

    start_date = date(year, 1, 1)
    end_date = date(year, 12, 31)

    tasks = Task.query.filter(
        Task.user_id == g.current_user.id,
        Task.scheduled_date >= start_date,
        Task.scheduled_date <= end_date
    ).all()

    completed = [t for t in tasks if t.status == 'completed']

    earned = PointLog.query.filter(
        PointLog.user_id == g.current_user.id,
        PointLog.created_at >= datetime.combine(start_date, datetime.min.time()),
        PointLog.created_at <= datetime.combine(end_date, datetime.max.time()),
        PointLog.delta > 0
    ).all()

    spent = PointLog.query.filter(
        PointLog.user_id == g.current_user.id,
        PointLog.created_at >= datetime.combine(start_date, datetime.min.time()),
        PointLog.created_at <= datetime.combine(end_date, datetime.max.time()),
        PointLog.delta < 0
    ).all()

    content = {
        'period': str(year),
        'period_start': start_date.isoformat(),
        'period_end': end_date.isoformat(),
        'summary': {
            'total_tasks': len(tasks),
            'completed_tasks': len(completed),
            'completion_rate': round(len(completed) / len(tasks), 2) if tasks else 0,
            'points_earned': sum(p.delta for p in earned),
            'points_spent': sum(abs(p.delta) for p in spent)
        },
        'completed_tasks': [{'id': t.id, 'title': t.title, 'scheduled_date': t.scheduled_date.isoformat()} for t in completed],
        'overdue_tasks': [],
        'upcoming_tasks': [],
        'comment_count': sum(1 for p in earned if p.reason == 'comment_added')
    }

    report = Report(user_id=g.current_user.id, type='yearly', period_start=start_date, period_end=end_date, content=content)
    db.session.add(report)
    db.session.commit()

    return jsonify(create_response(data={'report': content}))


@reports_bp.route('', methods=['GET'])
@token_required
def get_reports():
    report_type = request.args.get('type')
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)

    query = Report.query.filter_by(user_id=g.current_user.id)
    if report_type:
        query = query.filter_by(type=report_type)

    total = query.count()
    reports = query.order_by(Report.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return jsonify(create_response(data={'reports': [{'id': r.id, 'type': r.type, 'period_start': r.period_start.isoformat(), 'period_end': r.period_end.isoformat(), 'created_at': r.created_at.isoformat()} for r in reports], 'total': total}))
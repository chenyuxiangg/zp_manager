from flask import Blueprint, request, jsonify, g
from models import db, Report, Task, PointLog
from utils import token_required, create_response
from datetime import date, datetime, timedelta
from calendar import monthrange
from dateutil.parser import parse as parse_date
from collections import Counter

reports_bp = Blueprint('reports', __name__, url_prefix='/api/reports')


def get_week_range(d):
    start = d - timedelta(days=d.weekday())
    end = start + timedelta(days=6)
    return start, end


# ── B0321: 同比/环比 + 趋势/热力图/降级表 helper ────────────

def _prev_period(start, end):
    """计算上一周期（同长度，紧邻前一周/月/年）。"""
    days = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days - 1)
    return prev_start, prev_end


def _trend_series(start, end, completed_tasks, earned_logs):
    """每日趋势线：[{date, completed, points}] — TrendLineChart 数据源"""
    completed_by_date = Counter(t.scheduled_date for t in completed_tasks)
    points_by_date = Counter()
    for log in earned_logs:
        if log.created_at:
            points_by_date[log.created_at.date()] += log.delta
    series = []
    cur = start
    while cur <= end:
        series.append({
            'date': cur.isoformat(),
            'completed': completed_by_date.get(cur, 0),
            'points': points_by_date.get(cur, 0),
        })
        cur += timedelta(days=1)
    return series


def _heatmap(start, end, completed_tasks):
    """每日完成数：[{date, count}] — CompletionHeatmap 数据源"""
    counter = Counter(t.scheduled_date for t in completed_tasks)
    series = []
    cur = start
    while cur <= end:
        series.append({
            'date': cur.isoformat(),
            'count': counter.get(cur, 0),
        })
        cur += timedelta(days=1)
    return series


def _mobile_table(completed_tasks):
    """移动端降级表格：{columns, rows} — MobileFallbackTable 数据源"""
    return {
        'columns': ['日期', '任务', '积分'],
        'rows': [[t.scheduled_date.isoformat(), t.title, f"+{t.points}"] for t in completed_tasks],
    }


def _prev_stats(user_id, prev_start, prev_end):
    """上一周期聚合：completed/points_earned/comments — PeriodCompareCard 数据源"""
    tasks = Task.query.filter(
        Task.user_id == user_id,
        Task.scheduled_date >= prev_start,
        Task.scheduled_date <= prev_end,
    ).all()
    completed = sum(1 for t in tasks if t.status == 'completed')

    earned_logs = PointLog.query.filter(
        PointLog.user_id == user_id,
        PointLog.created_at >= datetime.combine(prev_start, datetime.min.time()),
        PointLog.created_at <= datetime.combine(prev_end, datetime.max.time()),
        PointLog.delta > 0,
    ).all()
    points_earned = sum(p.delta for p in earned_logs)
    comments = sum(1 for p in earned_logs if p.reason == 'comment_added')

    return {
        'prev_completed': completed,
        'prev_points_earned': points_earned,
        'prev_comments': comments,
    }


def _build_report_content(target_user_id, period_label, start_date, end_date,
                          tasks, completed, overdue, upcoming, earned, spent):
    """组装 reports 公共响应 content（B0321：含 trend_series/heatmap/table/prev_*）"""
    completed_tasks_full = [{'id': t.id, 'title': t.title, 'scheduled_date': t.scheduled_date.isoformat()} for t in completed]
    comment_count = sum(1 for p in earned if p.reason == 'comment_added')

    content = {
        'period': period_label,
        'period_start': start_date.isoformat(),
        'period_end': end_date.isoformat(),
        'summary': {
            'total_tasks': len(tasks),
            'completed_tasks': len(completed),
            'completion_rate': round(len(completed) / len(tasks), 2) if tasks else 0,
            'points_earned': sum(p.delta for p in earned),
            'points_spent': sum(abs(p.delta) for p in spent),
        },
        # 前端 PeriodCompareCard 同时读 `report.completed` 和 `report.summary.completed_tasks`，
        # 平铺两套兼容旧前端约定
        'completed': len(completed),
        'points_earned': sum(p.delta for p in earned),
        'comments': comment_count,
        'completed_tasks': completed_tasks_full,
        'overdue_tasks': [{'id': t.id, 'title': t.title, 'scheduled_date': t.scheduled_date.isoformat()} for t in overdue],
        'upcoming_tasks': [{'id': t.id, 'title': t.title, 'scheduled_date': t.scheduled_date.isoformat()} for t in tasks if t.status not in ['completed', 'overdue'] and t.scheduled_date >= date.today()],
        'comment_count': comment_count,
        # B0321：同比/环比 + ECharts 数据源
        **_prev_stats(target_user_id, *_prev_period(start_date, end_date)),
        'trend_series': _trend_series(start_date, end_date, completed, earned),
        'heatmap': _heatmap(start_date, end_date, completed),
        'table': _mobile_table(completed),
    }
    return content


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

    content = _build_report_content(
        g.current_user.id, f'{target.year}-W{target.isocalendar()[1]}',
        start_date, end_date, tasks, completed, overdue, tasks, earned, spent,
    )

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

    content = _build_report_content(
        g.current_user.id, f'{target.year}-{target.month:02d}',
        start_date, end_date, tasks, completed, overdue, tasks, earned, spent,
    )

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

    content = _build_report_content(
        g.current_user.id, str(year),
        start_date, end_date, tasks, completed, [], [], earned, spent,
    )

    report = Report(user_id=g.current_user.id, type='yearly', period_start=start_date, period_end=end_date, content=content)
    db.session.add(report)
    db.session.commit()

    return jsonify(create_response(data={'report': content}))


@reports_bp.route('/yearly-heatmap', methods=['GET'])
@token_required
def get_yearly_heatmap():
    """PR0007 §4.1：全年每日完成数（ECharts 热力图日历数据源）

    GET /api/reports/yearly-heatmap?year=YYYY
    返 {days: [{date: '2026-01-01', count: 3}, ...]} 共 365/366 天
    """
    from collections import Counter
    param_year = request.args.get('year', type=int)
    year = param_year or date.today().year

    start_date = date(year, 1, 1)
    _, last_day = monthrange(year, 12)
    end_date = date(year, 12, last_day)

    tasks = (
        Task.query.filter(
            Task.user_id == g.current_user.id,
            Task.status == 'completed',
            Task.scheduled_date >= start_date,
            Task.scheduled_date <= end_date,
        )
        .all()
    )

    counter = Counter(t.scheduled_date for t in tasks)
    days = []
    cur = start_date
    while cur <= end_date:
        days.append({
            'date': cur.isoformat(),
            'count': counter.get(cur, 0),
        })
        cur += timedelta(days=1)

    return jsonify(create_response(data={
        'year': year,
        'days': days,
    }))


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
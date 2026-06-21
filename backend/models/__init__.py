from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import BigInteger, Integer
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

# 跨方言 PK 类型：MySQL 用 BigInteger，SQLite 回退到 Integer（SQLite 的 AUTOINCREMENT 仅支持 INTEGER PRIMARY KEY）
PKType = BigInteger().with_variant(Integer, "sqlite")


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    points = db.Column(db.Integer, default=0)
    is_admin = db.Column(db.Boolean, default=False)
    notify_config = db.Column(db.JSON)
    # PR0002：用户本地时区（IANA TZ 名），cron 归日用
    timezone = db.Column(db.String(64), nullable=True)
    reset_token = db.Column(db.String(100))
    reset_token_expires_at = db.Column(db.DateTime)
    reset_token_sent_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    plans = db.relationship('Plan', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    point_logs = db.relationship('PointLog', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    reminders = db.relationship('Reminder', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    reports = db.relationship('Report', backref='user', lazy='dynamic', cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class TokenBlacklist(db.Model):
    __tablename__ = 'token_blacklist'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    jti = db.Column(db.String(100), unique=True, nullable=False)
    user_id = db.Column(PKType, db.ForeignKey('users.id'), nullable=False)
    revoked_at = db.Column(db.DateTime, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)


class Plan(db.Model):
    __tablename__ = 'plans'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    user_id = db.Column(PKType, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.Enum('active', 'completed', 'archived'), default='active')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stages = db.relationship('Stage', backref='plan', lazy='dynamic', cascade='all, delete-orphan')


class Stage(db.Model):
    __tablename__ = 'stages'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    plan_id = db.Column(PKType, db.ForeignKey('plans.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    order_num = db.Column(db.Integer, nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.Enum('pending', 'in_progress', 'completed'), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tasks = db.relationship('Task', backref='stage', lazy='dynamic', cascade='all, delete-orphan')


class Task(db.Model):
    __tablename__ = 'tasks'
    # B0238 + B0158：overdue scanner 按 (status, scheduled_date) 查询，加复合索引
    __table_args__ = (
        db.Index('idx_tasks_status_scheduled', 'status', 'scheduled_date'),
    )

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    user_id = db.Column(PKType, db.ForeignKey('users.id'), nullable=False)
    stage_id = db.Column(PKType, db.ForeignKey('stages.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    scheduled_date = db.Column(db.Date, nullable=False)
    completed_at = db.Column(db.DateTime)
    points = db.Column(db.Integer, default=10)
    status = db.Column(db.Enum('pending', 'in_progress', 'completed', 'overdue'), default='pending')
    # PR0002：扫描时刷新；RR1 字段保留（已有，但从未被代码写入）
    last_penalized_at = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    comments = db.relationship('Comment', backref='task', lazy='dynamic', cascade='all, delete-orphan')
    reminders = db.relationship('Reminder', backref='task', lazy='dynamic', cascade='all, delete-orphan')


class Comment(db.Model):
    __tablename__ = 'comments'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    task_id = db.Column(PKType, db.ForeignKey('tasks.id'), nullable=False)
    user_id = db.Column(PKType, db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    author = db.relationship('User', backref='comments', lazy='joined')


class PointLog(db.Model):
    __tablename__ = 'point_logs'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    user_id = db.Column(PKType, db.ForeignKey('users.id'), nullable=False)
    task_id = db.Column(PKType, db.ForeignKey('tasks.id'))
    delta = db.Column(db.Integer, nullable=False)
    reason = db.Column(db.String(100), nullable=False)
    # PR0003 / PR0015: 相关 task/comment ID 与反作弊溯源字段
    related_task_id = db.Column(PKType, nullable=True)
    related_comment_id = db.Column(PKType, nullable=True)
    operation = db.Column(db.Enum('award', 'refund', 'compute'), default='award', nullable=False)
    client_ip = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class EventOutbox(db.Model):
    """PR0004 transactional outbox：award/refund 与 toggle 路由同事务落库
    event_dispatcher consumer worker 拉取 published_at=NULL 的事件并 dispatch
    """
    __tablename__ = 'event_outbox'
    # B0221 + B0238：添加 (published_at, id) 索引，consumer 拉取避免全表扫
    __table_args__ = (
        db.Index('idx_outbox_unpublished', 'published_at', 'id'),
    )

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    event_name = db.Column(db.String(64), nullable=False)
    payload = db.Column(db.JSON, nullable=False)
    related_user_id = db.Column(PKType, nullable=True)
    related_task_id = db.Column(PKType, nullable=True)
    published_at = db.Column(db.DateTime, nullable=True)
    retry_count = db.Column(db.Integer, default=0, nullable=False)
    last_error = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Reminder(db.Model):
    __tablename__ = 'reminders'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    task_id = db.Column(PKType, db.ForeignKey('tasks.id'), nullable=False)
    user_id = db.Column(PKType, db.ForeignKey('users.id'), nullable=False)
    type = db.Column(db.Enum('learn', 'verify'), nullable=False)
    channel = db.Column(db.Enum('email', 'wechat', 'telegram'), nullable=False)
    scheduled_at = db.Column(db.DateTime, nullable=False)
    sent_at = db.Column(db.DateTime)
    status = db.Column(db.Enum('pending', 'sent', 'failed'), default='pending')
    # B0239：retry_count 旧字段已废弃，由 attempt_count 承担
    # alembic migration 兜底：ALTER TABLE reminders DROP COLUMN retry_count
    attempt_count = db.Column(db.Integer, default=0, nullable=False)
    next_retry_at = db.Column(db.DateTime, nullable=True)
    last_error = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class WorkerRun(db.Model):
    """PR0001：worker 调度审计表（cron 每跑一次写一行）"""
    __tablename__ = 'worker_runs'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    job_name = db.Column(db.String(64), nullable=False)
    started_at = db.Column(db.DateTime, nullable=False)
    finished_at = db.Column(db.DateTime, nullable=True)
    picked = db.Column(db.Integer, default=0, nullable=False)
    sent = db.Column(db.Integer, default=0, nullable=False)
    failed = db.Column(db.Integer, default=0, nullable=False)
    error = db.Column(db.Text, nullable=True)
    host = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class OverdueRun(db.Model):
    """PR0002：逾期扫描审计表（每日 00:05 一行）"""
    __tablename__ = 'overdue_runs'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    run_date = db.Column(db.Date, nullable=False)
    started_at = db.Column(db.DateTime, nullable=False)
    finished_at = db.Column(db.DateTime, nullable=True)
    scanned = db.Column(db.Integer, default=0, nullable=False)
    marked = db.Column(db.Integer, default=0, nullable=False)
    error = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class PomodoroSession(db.Model):
    """PR0021/PR0008：番茄钟会话记录"""
    __tablename__ = 'pomodoro_sessions'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    user_id = db.Column(PKType, db.ForeignKey('users.id'), nullable=False)
    task_id = db.Column(PKType, db.ForeignKey('tasks.id'), nullable=False)
    started_at = db.Column(db.DateTime, nullable=False)
    ended_at = db.Column(db.DateTime, nullable=True)
    planned_minutes = db.Column(db.Integer, default=25, nullable=False)
    actual_seconds = db.Column(db.Integer, nullable=True)
    completed = db.Column(db.Boolean, default=False, nullable=False)
    # PR0008 联动版用：本 PR 始终 False
    auto_toggled = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class StreakLog(db.Model):
    """PR0006：连续学习天数派生表（append-only）"""
    __tablename__ = 'streak_logs'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    user_id = db.Column(PKType, db.ForeignKey('users.id'), nullable=False)
    log_date = db.Column(db.Date, nullable=False)
    completed_count = db.Column(db.Integer, default=0, nullable=False)
    # B0223：record_count 专用于"防双调 fence"（与 completed_count 解耦）
    # sync 路径 + outbox consumer 路径各调一次 record_completion，record_count ≤ 2
    record_count = db.Column(db.Integer, default=0, nullable=False)
    prev_streak = db.Column(db.Integer, default=0, nullable=False)
    new_streak = db.Column(db.Integer, default=0, nullable=False)
    broken = db.Column(db.Boolean, default=False, nullable=False)
    source = db.Column(db.String(16), default='settle', nullable=False)  # backfill/settle/record
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


class Report(db.Model):
    __tablename__ = 'reports'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    user_id = db.Column(PKType, db.ForeignKey('users.id'), nullable=False)
    type = db.Column(db.Enum('weekly', 'monthly', 'yearly'), nullable=False)
    period_start = db.Column(db.Date, nullable=False)
    period_end = db.Column(db.Date, nullable=False)
    content = db.Column(db.JSON, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ScheduledJob(db.Model):
    __tablename__ = 'scheduled_jobs'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    job_id = db.Column(db.String(100), unique=True, nullable=False)
    func_name = db.Column(db.String(100), nullable=False)
    trigger_type = db.Column(db.String(50), nullable=False)
    trigger_args = db.Column(db.JSON)
    is_enabled = db.Column(db.Boolean, default=True)
    last_run_at = db.Column(db.DateTime)
    next_run_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PlanTemplate(db.Model):
    __tablename__ = 'plan_templates'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    user_id = db.Column(PKType, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    stages = db.relationship('TemplateStage', backref='template', lazy='dynamic', cascade='all, delete-orphan')


class TemplateStage(db.Model):
    __tablename__ = 'template_stages'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    template_id = db.Column(PKType, db.ForeignKey('plan_templates.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    order_num = db.Column(db.Integer, nullable=False)
    start_day = db.Column(db.Integer, nullable=False)
    end_day = db.Column(db.Integer, nullable=False)

    tasks = db.relationship('TemplateTask', backref='stage', lazy='dynamic', cascade='all, delete-orphan')


class TemplateTask(db.Model):
    __tablename__ = 'template_tasks'

    id = db.Column(PKType, primary_key=True, autoincrement=True)
    stage_id = db.Column(PKType, db.ForeignKey('template_stages.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    points = db.Column(db.Integer, default=10)
    day_offset = db.Column(db.Integer, nullable=False)
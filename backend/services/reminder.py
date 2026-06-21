"""
PR0001 — 提醒派发服务

从 services/reminder.py 改造：
- 拆出 _send_email() 公开方法（mock 友好）
- 新增 dispatch_pending() 函数：批量派发 + 退避 + 失败重试 + 写 worker_runs
- 保留 mail 实例供 forgot-password 等其他模块使用
"""
import logging
import socket
from datetime import datetime, timedelta
from typing import Dict
from flask import current_app
from flask_mail import Mail, Message

from models import db, Reminder, Task, User, WorkerRun


mail = Mail()
log = logging.getLogger(__name__)


# PR0001 §7：失败 1→5min / 2→15min / 3→失败终止
BACKOFF_MINUTES = {1: 5, 2: 15}
MAX_ATTEMPTS = 3
BATCH_SIZE = 200


def _send_email(reminder: Reminder) -> bool:
    """发一封邮件，返回 True 成功 / False 失败。

    与原 _send_reminder 区别：本函数是 transactional 边界，调用方负责
    状态/attempt_count 写入。
    """
    try:
        app = current_app._get_current_object()

        if reminder.channel != 'email':
            log.info(f'[Reminder] channel={reminder.channel} not supported, skipping')
            return False

        task = Task.query.get(reminder.task_id)
        if not task:
            return False

        user = User.query.get(reminder.user_id)
        if not user or not user.email:
            return False

        if reminder.type == 'learn':
            subject = f"[学习提醒] {task.title}"
            body = _build_learn_reminder_email(task, user.username)
        else:
            subject = f"[验收提醒] {task.title}"
            body = _build_verify_reminder_email(task, user.username)

        msg = Message(
            subject=subject,
            recipients=[user.email],
            body=body,
            sender=app.config.get('MAIL_DEFAULT_SENDER'),
        )
        mail.send(msg)
        return True
    except Exception as e:
        log.warning(f'[Reminder] send failed: {e}')
        return False


def dispatch_pending(dry_run: bool = False, batch_size: int = BATCH_SIZE) -> Dict[str, int]:
    """批量派发到期的 pending 提醒。

    Args:
        dry_run: True 时不发邮件，但仍然扫表 + 写 worker_runs
        batch_size: 单次最多取多少条

    Returns:
        dict: {picked, sent, failed}
    """
    host = socket.gethostname()[:64]
    started_at = datetime.utcnow()
    picked = sent = failed = 0
    error = None

    try:
        now = datetime.utcnow()
        # 拉取到期 + 未失败 + 退避时间已到的 pending
        reminders = (
            Reminder.query
            .filter(
                Reminder.status == 'pending',
                Reminder.scheduled_at <= now,
            )
            .filter(
                (Reminder.next_retry_at.is_(None)) | (Reminder.next_retry_at <= now)
            )
            .order_by(Reminder.scheduled_at)
            .limit(batch_size)
            .all()
        )
        picked = len(reminders)

        for r in reminders:
            if dry_run:
                continue
            ok = _send_email(r)
            r.attempt_count = (r.attempt_count or 0) + 1
            if ok:
                r.status = 'sent'
                r.sent_at = datetime.utcnow()
                r.next_retry_at = None
                sent += 1
            else:
                if r.attempt_count >= MAX_ATTEMPTS:
                    r.status = 'failed'
                    r.last_error = f'failed after {r.attempt_count} attempts'
                else:
                    # 退避：attempt=1 → 5min, attempt=2 → 15min
                    minutes = BACKOFF_MINUTES.get(r.attempt_count, 60)
                    r.next_retry_at = datetime.utcnow() + timedelta(minutes=minutes)
                failed += 1

        if not dry_run:
            db.session.commit()
    except Exception as e:
        db.session.rollback()
        error = f'{type(e).__name__}: {e}'
        log.exception('[Reminder] dispatch failed')
    finally:
        # 写 worker_runs 一行
        try:
            run = WorkerRun(
                job_name='reminder_dispatch',
                started_at=started_at,
                finished_at=datetime.utcnow(),
                picked=picked,
                sent=sent,
                failed=failed,
                error=error,
                host=host,
            )
            db.session.add(run)
            db.session.commit()
        except Exception:
            db.session.rollback()

    return {'picked': picked, 'sent': sent, 'failed': failed}


def _build_learn_reminder_email(task, username):
    remaining = (task.scheduled_date - datetime.utcnow().date()).days
    time_desc = f"剩{remaining}天" if remaining > 0 else "今天到期"
    return f"""亲爱的 {username}：

您有一个学习任务即将开始：

任务：{task.title}
计划日期：{task.scheduled_date}
剩余时间：{time_desc}

请合理安排时间，按计划开始学习。

---
这是一封自动发送的邮件，请勿回复。
"""


def _build_verify_reminder_email(task, username):
    return f"""亲爱的 {username}：

您有一个学习任务今天到期，请及时验收：

任务：{task.title}
计划日期：{task.scheduled_date}

请完成学习后，在系统中提交您的验收评论。

---
这是一封自动发送的邮件，请勿回复。
"""

from datetime import datetime
from flask import current_app
from flask_mail import Mail, Message


mail = Mail()


def _send_reminder(reminder):
    """Send a single reminder email. Returns True on success, False on failure."""
    try:
        app = current_app._get_current_object()

        if reminder.channel != 'email':
            print(f"[Reminder] Channel '{reminder.channel}' not supported yet, skipping")
            return False

        from models import User, Task
        task = Task.query.get(reminder.task_id)
        if not task:
            print(f"[Reminder] Task {reminder.task_id} not found")
            return False

        user = User.query.get(reminder.user_id)
        if not user or not user.email:
            print(f"[Reminder] User {reminder.user_id} has no email")
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
            sender=app.config.get('MAIL_DEFAULT_SENDER')
        )

        mail.send(msg)
        print(f"[Reminder] Email sent to {user.email} for task {task.title}")
        return True

    except Exception as e:
        print(f"[Reminder] Failed to send email: {e}")
        raise


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
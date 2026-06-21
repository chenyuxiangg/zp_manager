"""
PR0004 — 积分服务（PointsService）

把 routes/tasks.py 中 4 处积分数学抽到此处，所有积分相关 PR（PR0003/0006/0010/0015）
都通过本服务访问积分经济。

设计约束（PR0004 §2-7）：
- routes/ 中不允许直接 user.points += 或 PointLog(...) 构造
- compute/award/refund 各自一个事务
- 与 toggle 路由同事务写 event_outbox（B0170）
- on_time 必填 kwarg（B0173）
- 余额下限保护：user.points = max(0, user.points + delta)
- 异常类型：InsufficientPointsError / RefundWithoutLogError
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List, Dict, Any
from flask import request

from models import db, User, Task, PointLog, EventOutbox
from utils import locked_query, server_now  # B0222：award 幂等检查加 task 行锁


# ── 公开枚举 ─────────────────────────────────────────
class PointsReason:
    TASK_COMPLETED       = 'task_completed'
    TASK_COMPLETED_LATE  = 'task_completed_late'
    TASK_REVERTED        = 'task_reverted'
    COMMENT_ADDED        = 'comment_added'
    COMMENT_REVOKED      = 'comment_revoked'
    POMODORO_AUTO_TOGGLE = 'pomodoro_auto_toggle'


# ── 异常类型 ─────────────────────────────────────────
class InsufficientPointsError(Exception):
    """用户余额不足（积分数学错误或反作弊触发）"""


class RefundWithoutLogError(Exception):
    """撤销无对应 award log：审计链断裂"""


class TaskNotFound(Exception):
    """task 不存在（award 等需要在 db 中查的入口用）"""


# ── 决策对象 ─────────────────────────────────────────
@dataclass(frozen=True)
class PointsDecision:
    delta: int
    reason: str
    log_operation: str
    source: str = 'manual'
    note: Optional[str] = None


# ── 服务实现 ─────────────────────────────────────────
class PointsService:
    """积分经济领域服务。无状态，可通过类方法直接调用。"""

    @staticmethod
    def compute(task: Task, *, on_time: bool) -> PointsDecision:
        """纯计算：根据 task.points 与 on_time 返回应奖励积分。
        on_time 是必填 kwarg（B0173），调用方忘传会 raise TypeError。
        """
        full = task.points or 10
        if on_time:
            return PointsDecision(
                delta=full,
                reason=PointsReason.TASK_COMPLETED,
                log_operation='award',
            )
        else:
            return PointsDecision(
                delta=full // 2,
                reason=PointsReason.TASK_COMPLETED_LATE,
                log_operation='award',
            )

    @staticmethod
    def award(user: User, task: Task, *, on_time: bool,
              source: str = 'manual') -> PointLog:
        """给 user 加积分 + 写 PointLog + 同事务写 outbox 事件。

        Args:
            user: 加分对象
            task: 触发 task（必须 status='completed'）
            on_time: 是否准时
            source: 'manual' / 'pomodoro_auto_toggle' 等
        """
        if task.status != 'completed':
            raise ValueError(
                f'award requires task.status=completed, got {task.status!r}'
            )

        # B0222：锁住 task 行让后续幂等检查原子化（防并发 race window）
        # 复用 PR0004 行锁模式（locked_query 兼容 SQLite/PostgreSQL/MySQL）
        task = locked_query(Task.query.filter_by(id=task.id)).first()
        if task is None or task.status != 'completed':
            raise ValueError(
                f'award requires task.status=completed, got {task.status!r}'
            )

        # 幂等性保护：同 task 的最近一次 award 若未撤销 → 拒绝重复 award
        # 撤销后允许重新 award（toggle 来回切场景）
        last_award = (
            PointLog.query
            .filter_by(task_id=task.id, operation='award')
            .order_by(PointLog.id.desc())
            .first()
        )
        if last_award is not None:
            has_subsequent_refund = (
                PointLog.query
                .filter(
                    PointLog.task_id == task.id,
                    PointLog.operation == 'refund',
                    PointLog.id > last_award.id,
                )
                .first()
            ) is not None
            if not has_subsequent_refund:
                raise ValueError(
                    f'task {task.id} already has unrefunded award log id={last_award.id}, '
                    f'use refund() to revert before re-award'
                )

        decision = PointsService.compute(task, on_time=on_time)

        # PR0008：source='pomodoro_auto_toggle' 时 reason 覆盖为 POMODORO_AUTO_TOGGLE
        # 便于报表区分"自动完成"与"手动完成"激励
        reason = decision.reason
        if source == 'pomodoro_auto_toggle':
            reason = PointsReason.POMODORO_AUTO_TOGGLE

        # 反作弊溯源（B0163：取 X-Forwarded-For 首跳）
        client_ip = None
        user_agent = None
        try:
            if request:
                xff = request.headers.get('X-Forwarded-For', request.remote_addr or '')
                client_ip = xff.split(',')[0].strip() if xff else None
                user_agent = (request.headers.get('User-Agent') or '')[:255]
        except RuntimeError:
            # 不在 request context（如 worker 脚本）时跳过
            pass

        log = PointLog(
            user_id=user.id,
            task_id=task.id,
            # B0226：related_task_id 与 task_id 当前同值（语义重复）
            # 保留双字段以兼容 B0172 跨 PR 一致性约束；
            # RR3 评估统一为 task_id
            related_task_id=task.id,
            delta=decision.delta,
            reason=reason,
            operation='award',
            client_ip=client_ip,
            user_agent=user_agent,
        )
        db.session.add(log)

        # 余额更新（下限保护）
        new_points = user.points + decision.delta
        if new_points < 0:
            raise InsufficientPointsError(
                f'user.points would be {new_points} (< 0) after delta={decision.delta}'
            )
        user.points = new_points

        # 同事务写 outbox（B0170/B0171）
        event_name = 'TaskCompleted' if source == 'manual' else f'TaskCompleted.{source}'
        outbox = EventOutbox(
            event_name=event_name,
            payload={
                'user_id': user.id,
                'task_id': task.id,
                'today': server_now().date().isoformat(),
                'points_delta': decision.delta,
                'source': source,
            },
            related_user_id=user.id,
            related_task_id=task.id,
        )
        db.session.add(outbox)

        return log

    @staticmethod
    def refund(user: User, task: Task, last_log: Optional[PointLog],
               reason: str = PointsReason.TASK_REVERTED) -> PointLog:
        """撤销一次 award：写对冲 PointLog（delta = -last_log.delta）。

        Args:
            user: 扣分对象
            task: 触发 task
            last_log: 之前 award 的 PointLog（None 时 raise RefundWithoutLogError）
            reason: PointsReason.TASK_REVERTED 等
        """
        if last_log is None:
            raise RefundWithoutLogError(
                f'cannot refund task {task.id} for user {user.id}: no award log found'
            )

        refund_log = PointLog(
            user_id=user.id,
            task_id=task.id,
            related_task_id=task.id,
            delta=-last_log.delta,
            reason=reason,
            operation='refund',
        )
        db.session.add(refund_log)

        # 余额下限保护：撤销时不能扣成负数
        user.points = max(0, user.points - last_log.delta)

        return refund_log

    @staticmethod
    def award_comment(user: User, task: Task, comment_id: Optional[int] = None) -> PointLog:
        """评论 +2（PR0004 暴露，PR0015 配套 refund_comment 使用）"""
        log = PointLog(
            user_id=user.id,
            task_id=task.id,
            related_task_id=task.id,
            related_comment_id=comment_id,
            delta=2,
            reason=PointsReason.COMMENT_ADDED,
            operation='award',
        )
        db.session.add(log)
        user.points = max(0, user.points + 2)

        # outbox 事件
        db.session.add(EventOutbox(
            event_name='CommentAdded',
            payload={
                'user_id': user.id,
                'task_id': task.id,
                'comment_id': comment_id,
                'points_delta': 2,
            },
            related_user_id=user.id,
            related_task_id=task.id,
        ))

        return log

    @staticmethod
    def refund_comment(user: User, task: Task, comment_id: int) -> Optional[PointLog]:
        """PR0015：删除评论时对冲积分。
        找原 award log：WHERE related_comment_id = comment_id AND reason = COMMENT_ADDED
        若存在：写对冲 PointLog(reason=COMMENT_REVOKED, delta=-2) + user.points -= 2
        若不存在（老数据 / 重复删）：返 None，不写 log 不扣分。
        """
        original = (
            PointLog.query
            .filter_by(
                user_id=user.id,
                task_id=task.id,
                related_comment_id=comment_id,
                reason=PointsReason.COMMENT_ADDED,
            )
            .order_by(PointLog.id.desc())
            .first()
        )
        if original is None:
            return None  # 幂等：原 log 不存在（老数据 / 重复删）

        refund_log = PointLog(
            user_id=user.id,
            task_id=task.id,
            related_task_id=task.id,
            related_comment_id=comment_id,
            delta=-2,
            reason=PointsReason.COMMENT_REVOKED,
            operation='refund',
        )
        db.session.add(refund_log)
        user.points = max(0, user.points - 2)

        # outbox 事件
        db.session.add(EventOutbox(
            event_name='CommentRevoked',
            payload={
                'user_id': user.id,
                'task_id': task.id,
                'comment_id': comment_id,
                'points_delta': -2,
            },
            related_user_id=user.id,
            related_task_id=task.id,
        ))

        return refund_log

    @staticmethod
    def find_last_award_log(task_id: int) -> Optional[PointLog]:
        """查最近一条 award log（toggle 撤销分支用）"""
        return (
            PointLog.query
            .filter_by(task_id=task_id, operation='award')
            .order_by(PointLog.id.desc())
            .first()
        )

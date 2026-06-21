"""
PR0006 — Streak 服务

Streak 是 User 聚合上的派生统计（不直接做 User 表字段）。
append-only 事件日志 `streak_logs` 记录每日结算。

B0191 防双调：attempt_count 上限 2（sync + outbox 路径各 1 次）。
"""
import logging
from datetime import date, datetime
from typing import Optional

from models import db, User, StreakLog
from sqlalchemy import func

log = logging.getLogger(__name__)


# B0228：抽常量（10 年上限，避免恶意注入）
MAX_STREAK_DAYS = 3650


class StreakService:
    """连续学习天数服务。"""

    @staticmethod
    def record_completion(
        user_id: int,
        today: date,
        source: str = 'record',
    ) -> Optional[StreakLog]:
        """记录用户当日完成 1 个 task（事件驱动）。

        6.2 B0229 修订：source 显式区分触发路径
        - 'record' (默认): sync fallback（routes/tasks.py:toggle_task 同 worker 立即调）
        - 'outbox': event_dispatcher 兜底（worker/event_dispatcher.py 30s cron 拉 outbox 后调）
        - 'settle': services/streak.py:settle_today 每日 cron 结算

        同日多次调用：用 record_count 上限保护（≤2），防止 sync + outbox 双路径重复调。
        第一个 source 值保留（已有 row 时不更新 source 字段）。
        """
        try:
            existing = (
                db.session.query(StreakLog)
                .filter_by(user_id=user_id, log_date=today)
                .with_for_update()
                .first()
            )
        except Exception:
            existing = (
                StreakLog.query
                .filter_by(user_id=user_id, log_date=today)
                .first()
            )

        if existing is None:
            # 首次记录当日
            log_row = StreakLog(
                user_id=user_id, log_date=today,
                completed_count=1, record_count=1,
                prev_streak=0, new_streak=1,
                broken=False, source=source,
            )
            db.session.add(log_row)
            db.session.commit()
            return log_row

        # B0223：record_count fence
        if existing.record_count >= 2:
            log.debug(f'[Streak] record_count 限 2，跳过双调 user={user_id}')
            return existing
        existing.record_count += 1
        existing.completed_count += 1
        # 6.2 B0229：保留第一个 source 值（已有 row 时不更新）
        # 例：sync 'record' 写后再来 outbox 'outbox'，仍保留 'record'（反映真正的人工触发）
        # 例：跨 worker 直接 outbox 'outbox' 第一次写，source 正确
        db.session.commit()
        return existing

    @staticmethod
    def settle_today(user: User, today: date) -> StreakLog:
        """每日结算：写一行 streak_logs(log_date=today)。

        语义：settle_today(today) 是 cron 在 today 结束后跑的，
        算的是"YESTERDAY（= today-1）这一天的 streak 状态"。
        从 yesterday 往回数连续 completed_count >= 1 的天数。
        """
        from datetime import timedelta
        existing = StreakLog.query.filter_by(
            user_id=user.id, log_date=today,
        ).first()
        if existing is not None and existing.source == 'settle':
            return existing  # 幂等

        yesterday = today - timedelta(days=1)
        # 从 yesterday 往回数
        cur = yesterday
        consecutive = 0
        while True:
            log_row = StreakLog.query.filter_by(
                user_id=user.id, log_date=cur,
            ).first()
            if log_row is None or log_row.completed_count < 1:
                break
            consecutive += 1
            cur = cur - timedelta(days=1)
            if consecutive > MAX_STREAK_DAYS:
                break

        new_streak = consecutive
        broken = False
        prev_streak = 0
        # 找断点之前的最后一条 streak
        earlier = (
            StreakLog.query
            .filter(StreakLog.user_id == user.id, StreakLog.log_date < cur)
            .order_by(StreakLog.log_date.desc())
            .first()
        )
        if earlier is not None:
            prev_streak = earlier.new_streak
            if new_streak == 0 and prev_streak > 0:
                broken = True

        if existing is not None:
            # 复用 row：保留 record 路径写的 completed_count，只补 streak
            existing.prev_streak = prev_streak
            existing.new_streak = new_streak
            existing.broken = broken
            existing.source = 'settle' if existing.source == 'record' else existing.source
            db.session.commit()
            return existing

        log_row = StreakLog(
            user_id=user.id, log_date=today,
            completed_count=0,  # settle 默认无完成（record 路径会改）
            prev_streak=prev_streak, new_streak=new_streak,
            broken=broken, source='settle',
        )
        db.session.add(log_row)
        db.session.commit()
        return log_row

    @staticmethod
    def current(user: User) -> int:
        """最新一行 streak_log 的 new_streak"""
        latest = (
            StreakLog.query
            .filter_by(user_id=user.id)
            .order_by(StreakLog.log_date.desc())
            .first()
        )
        return latest.new_streak if latest else 0

    @staticmethod
    def longest(user: User) -> int:
        """历史最大 new_streak"""
        result = (
            db.session.query(func.max(StreakLog.new_streak))
            .filter_by(user_id=user.id)
            .scalar()
        )
        return result or 0

    @staticmethod
    def days_to_next_milestone(user: User, milestone: int = 7) -> int:
        """距 milestone 还差 N 天"""
        c = StreakService.current(user)
        return max(0, milestone - c)

    @staticmethod
    def last_broken_at(user: User):
        """最近一个 broken=TRUE 的 log_date"""
        log_row = (
            StreakLog.query
            .filter_by(user_id=user.id, broken=True)
            .order_by(StreakLog.log_date.desc())
            .first()
        )
        return log_row.log_date if log_row else None

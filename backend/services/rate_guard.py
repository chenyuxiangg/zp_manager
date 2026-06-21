"""
PR0003 — 反刷分时间窗口守卫

30 分钟内同一 task 的多次 toggle 仅首次成功；后续 toggle 返 409 RATE_LIMITED。
source 白名单（pomodoro_auto_toggle 等）直接放行，不受 30min 窗口限制。

设计目标（PR0003 §2-7）：
- 仅对 toggle（写积分的入口）生效，不影响 complete/DELETE
- source whitelist 与 rate_guard 同一处配置
- retry_after_seconds 返整数秒，精度到秒
"""
import math  # B0235：上移至文件顶
from datetime import datetime
from typing import Tuple
from sqlalchemy import and_, or_

from models import db, PointLog


# 30 分钟窗口（PR0003 §2 决策：N = 30 分钟）
WINDOW_SECONDS = 30 * 60

# source 白名单：直接放行，不走 30min 窗口
SOURCE_WHITELIST = frozenset({'pomodoro_auto_toggle'})


class RateGuard:
    """反刷分时间窗口检查器"""

    @staticmethod
    def can_toggle(user_id: int, task_id: int, *,
                   now: datetime = None,
                   source: str = 'manual') -> Tuple[bool, int]:
        """判断是否允许 toggle。

        Args:
            user_id: 操作者
            task_id: 目标 task
            now: 当前时间（默认 utcnow，便于测试时注入 fake 时间）
            source: 操作来源（'manual' / 'pomodoro_auto_toggle' 等）

        Returns:
            (is_allowed, retry_after_seconds)
            - (True, 0)：允许
            - (False, N)：禁止，N 秒后可重试
        """
        # 白名单直接放行
        if source in SOURCE_WHITELIST:
            return True, 0

        if now is None:
            now = datetime.utcnow()

        # 查最近一次未撤销的 award log
        last_award = (
            PointLog.query
            .filter_by(task_id=task_id, operation='award', user_id=user_id)
            .order_by(PointLog.created_at.desc())
            .first()
        )
        if last_award is None:
            return True, 0

        # 若 award 之后有 refund，则视为已撤销，不拦
        has_subsequent_refund = (
            PointLog.query
            .filter(
                PointLog.task_id == task_id,
                PointLog.user_id == user_id,
                PointLog.operation == 'refund',
                PointLog.id > last_award.id,
            )
            .first()
        ) is not None
        if has_subsequent_refund:
            return True, 0

        elapsed = (now - last_award.created_at).total_seconds()
        if elapsed >= WINDOW_SECONDS:
            return True, 0

        retry_after = math.ceil(WINDOW_SECONDS - elapsed)
        # 防御：避免传 0（极端情况 elapsed = WINDOW_SECONDS - 0.0001）
        return False, max(retry_after, 1)

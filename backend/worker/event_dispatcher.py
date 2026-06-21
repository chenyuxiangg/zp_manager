"""
B0221 P0 — Outbox consumer worker

PR0004 §6 transactional outbox 模式的消费侧：每 30s cron 拉取
published_at=NULL 的事件 → 调订阅者（StreakService.record_completion） →
UPDATE published_at。跨 worker 兜底（PR0006 toggle 路由 sync fallback
同 worker 立即生效，跨 worker 时 30s 内补上）。

cron 示例：
    * * * * * cd /opt/zpersion/backend && sleep 30; /usr/bin/python -m worker.event_dispatcher >> /var/log/zpersion/dispatcher.log 2>&1
    # 或 systemd timer 每 30s 跑一次
"""
import logging
import os
import sys
from datetime import datetime
from typing import Dict

# 让 worker 脚本可独立运行
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

log = logging.getLogger('event_dispatcher')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
)


BATCH_SIZE = 100


def dispatch_pending() -> Dict[str, int]:
    """拉取并分发未发布事件。

    Returns:
        dict: {picked, dispatched, failed}
    """
    from flask import has_app_context
    from models import db, EventOutbox
    from services.scheduler_lock import WorkerLock

    # 复用现有 app context（测试场景）；生产无 context 时新建
    if has_app_context():
        return _do_dispatch(db, EventOutbox, WorkerLock)

    from app import create_app
    app = create_app()
    with app.app_context():
        return _do_dispatch(db, EventOutbox, WorkerLock)


def _do_dispatch(db, EventOutbox, WorkerLock) -> Dict[str, int]:
    with WorkerLock('event_dispatch', timeout=240) as acquired:
        if not acquired:
            log.info('[event_dispatcher] lock not acquired, skip.')
            return {'picked': 0, 'dispatched': 0, 'failed': 0}

        picked = 0
        dispatched = 0
        failed = 0

        # 拉取未发布事件（按 id 升序，幂等）
        try:
            events = (
                db.session.query(EventOutbox)
                .filter(EventOutbox.published_at.is_(None))
                .order_by(EventOutbox.id)
                .limit(BATCH_SIZE)
                .all()
            )
        except Exception as e:
            log.exception(f'[event_dispatcher] query failed: {e}')
            return {'picked': 0, 'dispatched': 0, 'failed': 0}

        picked = len(events)
        for ev in events:
            try:
                _dispatch_one(ev)
                ev.published_at = datetime.utcnow()
                dispatched += 1
            except Exception as e:
                ev.retry_count += 1
                ev.last_error = f'{type(e).__name__}: {e}'[:500]
                failed += 1
                log.warning(
                    f'[event_dispatcher] dispatch failed '
                    f'(id={ev.id}, name={ev.event_name}, '
                    f'retry={ev.retry_count}): {e}'
                )

        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            log.exception(f'[event_dispatcher] commit failed: {e}')

        return {'picked': picked, 'dispatched': dispatched, 'failed': failed}


def _dispatch_one(ev: 'EventOutbox') -> None:
    """根据 event_name 派发到订阅者。

    当前订阅者：
    - TaskCompleted* → StreakService.record_completion（PR0006 强依赖）
    - CommentAdded / CommentRevoked → 留作 PR0015 RR3 扩展
    """
    from datetime import date
    from services.streak import StreakService

    event_name = ev.event_name
    if event_name.startswith('TaskCompleted') or event_name == 'TaskCompleted':
        today_str = ev.payload.get('today')
        if today_str:
            try:
                today = date.fromisoformat(today_str)
            except (TypeError, ValueError):
                today = datetime.utcnow().date()
        else:
            today = datetime.utcnow().date()
        # 6.2 B0229：dispatcher 显式传 source='outbox'（区分 sync fallback）
        StreakService.record_completion(ev.related_user_id, today, source='outbox')
    # CommentAdded/CommentRevoked 当前无 streak 副作用（PR0015 已在路由层对冲）


def main():
    stats = dispatch_pending()
    log.info(
        f'[event_dispatcher] picked={stats["picked"]} '
        f'dispatched={stats["dispatched"]} failed={stats["failed"]}'
    )
    return 0


if __name__ == '__main__':
    sys.exit(main())

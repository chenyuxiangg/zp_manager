"""
PR0002 — 逾期任务自动标记服务

每日凌晨 cron 把 status IN ('pending','in_progress') AND scheduled_date < today
的 task 标 'overdue'，写 last_penalized_at；
B0005：扫描时若 scheduled_date >= today 且 status='overdue'，改回 'pending'。
"""
import logging
import os
from datetime import date, datetime
from typing import Dict
from flask import current_app

from models import db, Task, OverdueRun
from utils import locked_query  # 复用 PR0004 行锁（定义在 utils/__init__.py）

log = logging.getLogger(__name__)


# PR0002 §7 B0158：单批条数从环境变量读取，默认 200
BATCH_SIZE = int(os.environ.get('OVERDUE_BATCH_SIZE', '200'))


def scan_overdue(today: date = None, batch_size: int = BATCH_SIZE) -> Dict[str, int]:
    """扫描逾期任务并标记。

    Args:
        today: 归日基准（默认 date.today()，便于测试时注入）
        batch_size: 单批最多处理多少

    Returns:
        dict: {scanned, marked}
    """
    if today is None:
        today = date.today()

    started_at = datetime.utcnow()
    scanned = 0
    marked = 0
    error = None

    try:
        # 事务 A：查 + 锁候选行（用 locked_query 兼容 SQLite/PostgreSQL/MySQL）
        # 注：SQLite 测试环境无行锁，依赖单连接串行化
        candidates = (
            locked_query(
                Task.query.filter(
                    Task.status.in_(['pending', 'in_progress']),
                    Task.scheduled_date < today,
                )
                .order_by(Task.id)
                .limit(batch_size)
            ).all()
        )
        scanned = len(candidates)

        # 事务 B：批量 UPDATE
        for t in candidates:
            t.status = 'overdue'
            t.last_penalized_at = today
        marked = len(candidates)

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        error = f'{type(e).__name__}: {e}'
        log.exception('[overdue] scan failed')
    finally:
        # 写 overdue_runs 一行（PR0002 §4 幂等：同日多次扫描共享一行）
        try:
            existing = OverdueRun.query.filter_by(run_date=today).first()
            if existing is None:
                run = OverdueRun(
                    run_date=today,
                    started_at=started_at,
                    finished_at=datetime.utcnow(),
                    scanned=scanned,
                    marked=marked,
                    error=error,
                )
                db.session.add(run)
            else:
                # 累加（同日多次扫描，cron 漏跑后补跑也兼容）
                existing.scanned += scanned
                existing.marked += marked
                existing.finished_at = datetime.utcnow()
                if error and not existing.error:
                    existing.error = error
            db.session.commit()
        except Exception:
            db.session.rollback()

    return {'scanned': scanned, 'marked': marked}


def mark_pending_recovery(today: date = None) -> int:
    """B0005：把 overdue + scheduled_date >= today 的 task 改回 pending。

    Returns:
        恢复条数
    """
    if today is None:
        today = date.today()

    try:
        tasks = (
            Task.query.filter(
                Task.status == 'overdue',
                Task.scheduled_date >= today,
            ).all()
        )
        for t in tasks:
            t.status = 'pending'
            t.last_penalized_at = None
        db.session.commit()
        return len(tasks)
    except Exception:
        db.session.rollback()
        log.exception('[overdue] recovery failed')
        return 0

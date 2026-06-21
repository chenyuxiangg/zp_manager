"""
PR0001 §5 + B0153：WorkerLock 跨机互斥

基于 MySQL GET_LOCK 的命名锁；SQLite 测试环境跳过（不支持）。
PR0001 验收：worker 跑 240s 内不会因其他 worker 拿到锁而重复触发。
"""
import logging
import socket
from contextlib import contextmanager
from flask import current_app

log = logging.getLogger(__name__)


class WorkerLock:
    """MySQL GET_LOCK 包装，跨 worker 互斥。"""

    def __init__(self, name: str, timeout: int = 240):
        self.name = name
        self.timeout = timeout
        self.acquired = False
        self._conn = None

    def __enter__(self):
        from models import db
        dialect = db.engine.dialect.name
        if dialect not in ('mysql', 'postgresql'):
            # SQLite 测试环境：模拟 acquire=True
            log.debug(f'[WorkerLock] SQLite mock acquire: {self.name}')
            self.acquired = True
            return True
        try:
            self._conn = db.engine.connect()
            # MySQL: GET_LOCK(name, timeout) 返 1=成功 / 0=超时 / NULL=错误
            row = self._conn.exec_driver_sql(
                f"SELECT GET_LOCK(%s, %s)", (self.name, self.timeout)
            ).fetchone()
            self.acquired = (row is not None and row[0] == 1)
            return self.acquired
        except Exception as e:
            log.warning(f'[WorkerLock] acquire failed: {e}')
            self.acquired = False
            return False

    def __exit__(self, exc_type, exc_val, exc_tb):
        # B0233：仅在确实持锁时才 release（避免 RELEASE_LOCK(NULL) 报错）
        if self.acquired and self._conn is not None:
            try:
                self._conn.exec_driver_sql("SELECT RELEASE_LOCK(%s)", (self.name,))
            except Exception as e:
                log.warning(f'[WorkerLock] release failed: {e}')
            finally:
                self._conn.close()
                self._conn = None
        return False

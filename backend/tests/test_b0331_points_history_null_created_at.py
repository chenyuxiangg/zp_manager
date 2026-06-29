"""
B0331 — GET /api/users/points/history 不应因 PointLog.created_at=NULL 崩溃

回归背景：
- PointLog.created_at 在 schema 里 nullable=True（migrations/.../05a05e23ee88...py:205）
- 老数据 / 跨环境导入 / 直接 SQL 写库都可能让 created_at 为 None
- 原实现 users.get_points_history 直接 `l.created_at.isoformat()`，
  一旦遇到 NULL 立刻 AttributeError → 500
- 该接口此前没有任何 pytest 用例覆盖（B0331 漏报修复时一并补）

守护：
1. 存在 NULL created_at 时端点返 200 + created_at=None（不抛 AttributeError）
2. 正常数据 created_at 仍是 ISO 字符串
3. 分页与 total 仍正常
"""
import os
import sys
from datetime import datetime

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from models import db, PointLog  # noqa: E402


@pytest.fixture
def point_log_with_null_ts(user, session):
    """显式插入一条 created_at=NULL 的历史记录（绕过 default）"""
    log = PointLog(
        user_id=user.id,
        task_id=None,
        delta=10,
        reason='null-ts-fixture',
        operation='award',
        # created_at=None 显式触发 bug
    )
    session.add(log)
    session.commit()
    # SQLAlchemy default 可能在 flush 时填默认值；强制写 NULL
    session.execute(
        db.text("UPDATE point_logs SET created_at = NULL WHERE id = :id"),
        {'id': log.id},
    )
    session.commit()
    session.refresh(log)
    return log


@pytest.fixture
def point_log_with_ts(user, session):
    log = PointLog(
        user_id=user.id,
        task_id=None,
        delta=5,
        reason='with-ts',
        operation='award',
        created_at=datetime(2026, 6, 1, 12, 0, 0),
    )
    session.add(log)
    session.commit()
    return log


class TestPointsHistoryNullCreatedAt:
    def test_null_created_at_does_not_crash(self, client, auth_headers, point_log_with_null_ts):
        """【回归守护】NULL created_at 必须返 200 而非 500"""
        res = client.get('/api/users/points/history?page=1&limit=20', headers=auth_headers)
        assert res.status_code == 200, res.get_json()
        body = res.get_json()
        assert body['success'] is True
        assert body['data']['total'] == 1
        assert len(body['data']['logs']) == 1
        # 关键：created_at 序列化为 None，而不是崩溃
        assert body['data']['logs'][0]['created_at'] is None
        assert body['data']['logs'][0]['reason'] == 'null-ts-fixture'

    def test_normal_created_at_still_iso(
        self, client, auth_headers, point_log_with_ts, point_log_with_null_ts,
    ):
        """【正向守护】正常时间戳仍为 ISO 字符串，且 NULL 与正常共存"""
        res = client.get('/api/users/points/history?page=1&limit=20', headers=auth_headers)
        assert res.status_code == 200
        body = res.get_json()
        assert body['data']['total'] == 2
        # 两条记录都返回，且 created_at 一个是 ISO、一个是 None
        logs = {log['reason']: log for log in body['data']['logs']}
        assert logs['with-ts']['created_at'] == '2026-06-01T12:00:00'
        assert logs['null-ts-fixture']['created_at'] is None

    def test_pagination_still_works(self, client, auth_headers, session, user):
        """【回归守护】多条记录时分页仍正常，不被 NULL 拖垮"""
        # 造 25 条：5 条 NULL + 20 条正常
        for i in range(5):
            session.add(PointLog(user_id=user.id, task_id=None, delta=1,
                                 reason=f'null-{i}', operation='award'))
        session.commit()
        session.execute(db.text("UPDATE point_logs SET created_at = NULL WHERE reason LIKE 'null-%'"))
        session.commit()
        for i in range(20):
            session.add(PointLog(
                user_id=user.id, task_id=None, delta=1, reason=f'ok-{i}',
                operation='award', created_at=datetime(2026, 1, i + 1, 0, 0, 0),
            ))
        session.commit()

        r1 = client.get('/api/users/points/history?page=1&limit=20', headers=auth_headers)
        assert r1.status_code == 200
        body1 = r1.get_json()
        assert body1['data']['total'] == 25
        assert len(body1['data']['logs']) == 20

        r2 = client.get('/api/users/points/history?page=2&limit=20', headers=auth_headers)
        assert r2.status_code == 200
        body2 = r2.get_json()
        assert len(body2['data']['logs']) == 5
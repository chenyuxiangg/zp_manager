"""
迭代 8: toggle 行锁 with_for_update（联调报告遗留 #2）

生产 MySQL/PostgreSQL 需要行锁防止并发双倍扣分。
SQLite 不支持 FOR UPDATE —— 测试中需用 dialect 判断跳过锁。

策略：
- 在 conftest 中检测 db.engine.dialect.name
- 如非 sqlite，使用 with_for_update() 加行锁
- 单测验证行为不变（toggle 正确性、积分正确性）
- 并发测试不在 SQLite 范围（需生产 MySQL 验证）
"""
import pytest
from models import PointLog


# B0331：测试 toggle 撤销行为时需绕过 30min rate_guard，让撤销走真实逻辑
@pytest.fixture
def bypass_rate_guard(monkeypatch):
    from services.rate_guard import RateGuard
    monkeypatch.setattr(RateGuard, 'can_toggle',
                        staticmethod(lambda *a, **kw: (True, 0)))


class TestToggleLockHelper:
    """toggle_locked_query 工具函数"""

    def test_locked_query_works_on_sqlite(self, task):
        """SQLite 下应返回原 query 对象（无锁）"""
        from utils import locked_query
        from models import Task
        q = locked_query(Task.query.filter_by(id=task.id))
        # 不抛异常，能正常执行
        result = q.first()
        assert result is not None
        assert result.id == task.id

    def test_locked_query_returns_query_object(self, task):
        """返回值仍是 Query 对象（支持链式 .first() 等）"""
        from utils import locked_query
        from models import Task
        result = locked_query(Task.query)
        # 可继续链式调用
        assert result.filter_by(id=task.id).first() is not None


class TestToggleBehaviorWithLock:
    """验证 toggle 行为在锁定/非锁定路径下都正确"""

    def test_concurrent_toggle_serializes_via_app(self, client, auth_headers, task, user, session, bypass_rate_guard):
        """验证连续两次 toggle 不会破坏数据完整性（通过 application-level 串行化）

        SQLite 不支持行锁，但 Flask test client 是单线程串行的。
        此测试验证在串行调用下，状态正确流转。
        B0331：撤销方向现在被 rate_guard 拦截，所以本测试用 bypass_rate_guard
        让 toggle 行为保持 RR1 既定链路。
        """
        user.points = 0
        session.commit()

        # 第一次 toggle: pending → completed (+10)
        r1 = client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        assert r1.get_json()['data']['task']['status'] == 'completed'
        assert r1.get_json()['data']['points_delta'] == 10

        # 第二次 toggle: completed → pending (-10)
        r2 = client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        assert r2.get_json()['data']['task']['status'] == 'pending'
        assert r2.get_json()['data']['points_delta'] == -10

        session.refresh(user)
        assert user.points == 0

    def test_toggle_keeps_point_log_after_uncomplete(self, client, auth_headers, task, session, bypass_rate_guard):
        """撤销完成不删除 PointLog（保留审计）"""
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)

        logs = session.query(PointLog).filter_by(
            task_id=task.id, reason='task_completed'
        ).all()
        assert len(logs) == 1  # 只记录一次


class TestToggleUsesLockedQuery:
    """验证 toggle 路由使用了 locked_query 工具"""

    def test_toggle_route_uses_locked_query(self, app):
        """toggle 路由源码中应包含 locked_query 调用"""
        import inspect
        from routes.tasks import toggle_task
        source = inspect.getsource(toggle_task)
        assert 'locked_query' in source, \
            "toggle_task should use locked_query for row-level locking"

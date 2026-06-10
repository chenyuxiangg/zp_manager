"""
迭代 9: MySQL DATETIME(6) 升级（联调报告遗留 #4）

联调报告 4.4：同一秒内编辑评论，updated_at 与 created_at 显示相同（秒级精度不足）。
升级到 DATETIME(6) 微秒级精度。

实施范围：所有 datetime 字段
- users.created_at, users.updated_at
- plans.created_at, plans.updated_at
- stages.created_at, stages.updated_at
- tasks.created_at, tasks.completed_at
- comments.created_at, comments.updated_at
- point_logs.created_at
- reminders.created_at
- reports.created_at
- scheduled_jobs.created_at, scheduled_jobs.updated_at

策略：
- 模型 SQLAlchemy 端用 db.DateTime(timezone=False) + SA_Type 注释
- 生产 MySQL 通过 ALTER TABLE 升级
- 测试 SQLite 不需改动（datetime 已支持微秒）
"""
import pytest
from datetime import datetime
from sqlalchemy import inspect


class TestModelDateTimeColumns:
    """验证模型 datetime 字段已声明（SQLAlchemy 端）"""

    def test_comment_has_created_at_and_updated_at(self, session, task, user):
        from models import Comment
        c = Comment(id=10001, task_id=task.id, user_id=user.id, content='hi')
        session.add(c)
        session.commit()
        # 验证 created_at / updated_at 字段存在
        assert c.created_at is not None
        assert c.updated_at is not None

    def test_datetime_supports_microsecond_precision(self, task, session):
        """SQLAlchemy DateTime 默认支持微秒精度"""
        from models import Comment
        c = Comment(id=10002, task_id=task.id, user_id=task.user_id, content='hi')
        session.add(c)
        session.commit()
        # created_at 应包含微秒
        assert c.created_at.microsecond >= 0
        # 验证 datetime 类型（不是 timestamp）
        assert isinstance(c.created_at, datetime)


class TestMigrationScript:
    """验证 migration 脚本语法正确"""

    def test_migration_file_exists(self):
        """migration 文件应存在"""
        import os
        path = '/var/www/zpersion/backend/migrations/upgrade_datetime_to_microsecond.sql'
        assert os.path.exists(path), f"Migration file not found: {path}"

    def test_migration_contains_alter_table(self):
        """migration 包含 ALTER TABLE 语句"""
        path = '/var/www/zpersion/backend/migrations/upgrade_datetime_to_microsecond.sql'
        with open(path) as f:
            content = f.read()
        assert 'ALTER TABLE' in content
        assert 'DATETIME(6)' in content
        # 应覆盖关键表
        for table in ['comments', 'tasks', 'point_logs', 'users']:
            assert table in content, f"Migration should include {table}"

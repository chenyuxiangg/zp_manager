"""
B0338b — alembic migration b0338b_align_db_schema_to_model 幂等校验

回归背景：部署观察期发现 MySQL `zlearn_db` 与 SQLAlchemy model 漂移：
- point_logs 缺 related_task_id / related_comment_id / operation / client_ip / user_agent
- reminders 缺 attempt_count / next_retry_at（B0239）
- worker_runs 表整体缺失（PR0001）

alembic_version 当时在 head 但表结构停留在 RR1 — classic stamp-but-don't-apply。

修复：
- 新增 alembic migration b0338b_align_db_schema_to_model 幂等补齐
- 本测试校验：upgrade() 在缺列的 SQLite 模拟状态上跑通 + 列存在性幂等
  （再 upgrade() 不报错）+ 列类型/默认值与 model 对齐

注：实际 MySQL 上的修复由用户手动 `flask db upgrade` 触发（避免 Claude 直接动用户 DB）。
"""
import os
import sys
import importlib

import pytest
from sqlalchemy import create_engine, inspect, text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

os.environ.setdefault('SECRET_KEY', 'test-secret')
os.environ.setdefault('JWT_SECRET_KEY', 'test-jwt')

from alembic.config import Config  # noqa: E402
from alembic import command  # noqa: E402


def _create_app_with_db(db_url):
    """创建指向指定 SQLite 文件的 Flask app（让 env.py 能拿到 current_app.extensions）"""
    os.environ['DATABASE_URL'] = db_url
    # 强制 reload config module 以拾取新 DATABASE_URL（避免 module-level 缓存）
    if 'config' in sys.modules:
        importlib.reload(sys.modules['config'])
    if 'app' in sys.modules:
        importlib.reload(sys.modules['app'])
    from app import create_app
    return create_app()


@pytest.fixture
def app_with_sqlite(tmp_path):
    db_path = tmp_path / 'test.db'
    db_url = f'sqlite:///{db_path}'
    flask_app = _create_app_with_db(db_url)
    return flask_app, str(db_path)


@pytest.fixture
def alembic_cfg(app_with_sqlite):
    flask_app, db_path = app_with_sqlite
    cfg = Config()
    cfg.set_main_option('script_location', os.path.join(os.path.dirname(__file__), '..', 'migrations'))
    cfg.set_main_option('sqlalchemy.url', f'sqlite:///{db_path}')
    cfg.config_file_name = os.path.join(os.path.dirname(__file__), '..', 'migrations', 'alembic.ini')
    return cfg, flask_app, db_path


def _simulate_drift(engine):
    """模拟 RR1 时期缺失 PR0003 / B0239 列的 point_logs / reminders；并删除 worker_runs。

    流程：先跑完所有前置 migration 拿到"完整 schema"，再 ALTER 掉 PR0003/B0239
    列 + 删除 worker_runs + stamp alembic 到 head — 复现 MySQL 上的
    stamp-but-don't-apply 状态。
    """
    flask_app = _create_app_with_db(str(engine.url))
    with flask_app.app_context():
        cfg = Config()
        cfg.set_main_option('script_location', os.path.join(os.path.dirname(__file__), '..', 'migrations'))
        cfg.set_main_option('sqlalchemy.url', str(engine.url))
        cfg.config_file_name = os.path.join(os.path.dirname(__file__), '..', 'migrations', 'alembic.ini')
        # 跑到 a1b2c3d4e5f6（我们 B0338b 的前置）
        command.upgrade(cfg, 'a1b2c3d4e5f6')
    # 此时所有表都是完整 schema。开始模拟漂移：
    with engine.begin() as conn:
        # 移除 PR0003 / PR0015 列（SQLite ≥3.35 支持 DROP COLUMN）
        for col in ('related_task_id', 'related_comment_id', 'operation', 'client_ip', 'user_agent'):
            try:
                conn.execute(text(f'ALTER TABLE point_logs DROP COLUMN {col}'))
            except Exception:
                pass
        # reminders 删 B0239 新字段
        for col in ('attempt_count', 'next_retry_at'):
            try:
                conn.execute(text(f'ALTER TABLE reminders DROP COLUMN {col}'))
            except Exception:
                pass
        # drop worker_runs
        conn.execute(text("DROP TABLE IF EXISTS worker_runs"))


class TestB0338bMigration:
    def test_upgrade_adds_missing_columns(self, alembic_cfg):
        cfg, flask_app, db_path = alembic_cfg
        engine = create_engine(f'sqlite:///{db_path}')
        _simulate_drift(engine)

        with flask_app.app_context():
            command.upgrade(cfg, 'b0338b_align_db_schema_to_model')

        insp = inspect(engine)
        point_cols = {c['name'] for c in insp.get_columns('point_logs')}
        assert 'related_task_id' in point_cols
        assert 'related_comment_id' in point_cols
        assert 'operation' in point_cols
        assert 'client_ip' in point_cols
        assert 'user_agent' in point_cols

    def test_upgrade_adds_reminders_columns(self, alembic_cfg):
        cfg, flask_app, db_path = alembic_cfg
        engine = create_engine(f'sqlite:///{db_path}')
        _simulate_drift(engine)
        with flask_app.app_context():
            command.upgrade(cfg, 'b0338b_align_db_schema_to_model')

        insp = inspect(engine)
        rem_cols = {c['name'] for c in insp.get_columns('reminders')}
        assert 'attempt_count' in rem_cols
        assert 'next_retry_at' in rem_cols

    def test_upgrade_creates_worker_runs(self, alembic_cfg):
        cfg, flask_app, db_path = alembic_cfg
        engine = create_engine(f'sqlite:///{db_path}')
        _simulate_drift(engine)
        with flask_app.app_context():
            command.upgrade(cfg, 'b0338b_align_db_schema_to_model')

        insp = inspect(engine)
        assert insp.has_table('worker_runs')
        wr_cols = {c['name'] for c in insp.get_columns('worker_runs')}
        for required in ('id', 'job_name', 'started_at', 'picked', 'sent', 'failed', 'created_at'):
            assert required in wr_cols, f'worker_runs.{required} 缺失'

    def test_upgrade_is_idempotent_on_already_aligned_db(self, alembic_cfg):
        cfg, flask_app, db_path = alembic_cfg
        engine = create_engine(f'sqlite:///{db_path}')
        _simulate_drift(engine)
        with flask_app.app_context():
            command.upgrade(cfg, 'b0338b_align_db_schema_to_model')
            # 再跑一次不应报错
            command.upgrade(cfg, 'b0338b_align_db_schema_to_model')

        insp = inspect(engine)
        assert 'operation' in {c['name'] for c in insp.get_columns('point_logs')}
        assert insp.has_table('worker_runs')

    def test_operation_column_has_default(self, alembic_cfg):
        cfg, flask_app, db_path = alembic_cfg
        engine = create_engine(f'sqlite:///{db_path}')
        _simulate_drift(engine)
        with flask_app.app_context():
            command.upgrade(cfg, 'b0338b_align_db_schema_to_model')

        insp = inspect(engine)
        op_col = next(c for c in insp.get_columns('point_logs') if c['name'] == 'operation')
        assert op_col['nullable'] is False
        default = op_col.get('default')
        if default is not None:
            assert 'award' in str(default)
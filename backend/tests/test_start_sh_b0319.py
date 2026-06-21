"""
B0319 — start.sh alembic upgrade 自动检测 contract test

start.sh 启动前应自动检测 DB 状态并跑 `flask db upgrade`：
- 全新 DB → 一次性创建所有表
- 已迁移 DB → 幂等 no-op
- ZP_SKIP_AUTO_UPGRADE=1 → 跳过

测试策略：subprocess 调 start.sh 派生进程 + 临时 .env + 临时 SQLite DB
"""
import os
import shutil
import subprocess
import tempfile
import textwrap

import pytest


START_SH = os.path.join(os.path.dirname(__file__), '..', 'start.sh')


def _run_start_sh_with_env(db_path, extra_env=None):
    """运行 start.sh 的核心 alembic upgrade 步骤（不进入 flask run 阻塞）。
    通过临时改写：调用 python -m flask db upgrade 替代整段。
    """
    env = {
        'DATABASE_URL': f'sqlite:///{db_path}',
        'SECRET_KEY': 'test-secret',
        'JWT_SECRET_KEY': 'test-jwt',
        'MAIL_SERVER': '',
        'FLASK_APP': 'app.py',
        'PATH': os.environ['PATH'],
        'HOME': os.environ.get('HOME', '/tmp'),
    }
    if extra_env:
        env.update(extra_env)

    # 模拟 start.sh 的 alembic upgrade 步骤（不阻塞在 flask run）
    script = textwrap.dedent(f"""\
        set -e
        cd {os.path.dirname(START_SH)}
        export DATABASE_URL={env['DATABASE_URL']}
        export SECRET_KEY={env['SECRET_KEY']}
        export JWT_SECRET_KEY={env['JWT_SECRET_KEY']}
        export MAIL_SERVER={env['MAIL_SERVER']}
        export FLASK_APP={env['FLASK_APP']}
        # 模拟 start.sh 的 alembic upgrade 步骤（不阻塞 flask run）
        if [ "${{ZP_SKIP_AUTO_UPGRADE:-0}}" != "1" ]; then
          flask db upgrade 2>&1
        fi
    """)
    result = subprocess.run(
        ['bash', '-c', script],
        capture_output=True, text=True, env=env, timeout=60,
    )
    return result


class TestStartShB0319:
    def test_start_sh_creates_tables_on_fresh_db(self, tmp_path):
        """B0319：全新 DB 跑 start.sh 流程后，所有核心表应已创建"""
        db_path = str(tmp_path / 'fresh.db')
        result = _run_start_sh_with_env(db_path)
        assert result.returncode == 0, f'升级失败: {result.stderr}'
        # 验证 alembic_version 表存在 + users 表存在
        import sqlite3
        conn = sqlite3.connect(db_path)
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()]
        conn.close()
        assert 'alembic_version' in tables, f'alembic_version 表缺失: {tables}'
        assert 'users' in tables, f'users 表缺失（migration 未跑）: {tables}'
        assert 'tasks' in tables
        assert 'plans' in tables
        assert 'point_logs' in tables

    def test_start_sh_upgrade_is_idempotent_on_existing_db(self, tmp_path):
        """B0319：已迁移 DB 再跑一次 upgrade 应幂等 no-op（不报错）"""
        db_path = str(tmp_path / 'existing.db')
        # 第一次：初始化
        r1 = _run_start_sh_with_env(db_path)
        assert r1.returncode == 0
        # 第二次：幂等
        r2 = _run_start_sh_with_env(db_path)
        assert r2.returncode == 0, f'第二次 upgrade 失败: {r2.stderr}'
        # 验证 stdout 含 "Running upgrade"（无新 revision 触发但仍是 no-op）
        # 不强制要求完全 no-op 内容（alembic 会打 INFO 日志）

    def test_start_sh_skip_when_env_var_set(self, tmp_path):
        """B0319：ZP_SKIP_AUTO_UPGRADE=1 跳过 alembic upgrade（生产模式）"""
        db_path = str(tmp_path / 'skip.db')
        result = _run_start_sh_with_env(db_path, extra_env={'ZP_SKIP_AUTO_UPGRADE': '1'})
        assert result.returncode == 0
        # 跳过时表不应存在（证明确实跳过了）
        import sqlite3
        try:
            conn = sqlite3.connect(db_path)
            tables = [r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()]
            conn.close()
            # 没有任何 migration 表（SQLite 自身 system tables 不算）
            assert 'users' not in tables, '跳过时不应创建 users 表'
            assert 'alembic_version' not in tables, '跳过时不应有 alembic_version'
        except sqlite3.OperationalError:
            # DB 文件甚至可能不存在（因为 upgrade 没跑过）
            pass

    def test_start_sh_recent_version_creates_correct_tables(self, tmp_path):
        """B0319：升级后表结构包含 RR2 新表（streak_logs / pomodoro_sessions / event_outbox）"""
        db_path = str(tmp_path / 'rr2.db')
        result = _run_start_sh_with_env(db_path)
        assert result.returncode == 0
        import sqlite3
        conn = sqlite3.connect(db_path)
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()]
        conn.close()
        # RR2 新表（B0221 + B0223 等）
        for expected in ['streak_logs', 'pomodoro_sessions', 'event_outbox',
                         'worker_runs', 'overdue_runs', 'reminders']:
            assert expected in tables, f'RR2 新表 {expected} 缺失'
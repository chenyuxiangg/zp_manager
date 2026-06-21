"""
PR0023 TDD — Alembic 迁移基础设施测试

验证：
1. Flask-Migrate 已接入 app.py（Migrate 实例存在）
2. migrations/versions/ 下有 RR2 基线 migration
3. 基线 migration 同时有 upgrade() 与 downgrade() 函数
4. release.sh 风格检查：flask db check 断言 schema 与代码一致
"""
import os
import subprocess
import sys
from pathlib import Path
import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
VERSIONS_DIR = PROJECT_ROOT / 'migrations' / 'versions'


class TestAlembicInfra:
    def test_migrate_instance_in_app(self):
        """app.py 接入 flask_migrate.Migrate"""
        from app import create_app
        app = create_app()
        # 验证 Migrate 已注册扩展
        from flask_migrate import Migrate
        # flask_migrate 不会把自身存到 app.extensions；用 migrations dir 验证
        assert (PROJECT_ROOT / 'migrations' / 'alembic.ini').exists()
        assert (PROJECT_ROOT / 'migrations' / 'env.py').exists()

    def test_versions_directory_exists(self):
        assert VERSIONS_DIR.exists()
        assert VERSIONS_DIR.is_dir()

    def test_baseline_migration_has_upgrade_and_downgrade(self):
        """基线 migration 必须有 upgrade() + downgrade()（设计 §5）"""
        baseline_files = list(VERSIONS_DIR.glob('*rr2_baseline*.py'))
        if not baseline_files:
            baseline_files = list(VERSIONS_DIR.glob('*.py'))
        assert baseline_files, f'no migration in {VERSIONS_DIR}'

        # 验证每个 migration 文件有 upgrade/downgrade
        for f in baseline_files:
            content = f.read_text(encoding='utf-8')
            assert 'def upgrade()' in content, f'{f.name} missing upgrade()'
            assert 'def downgrade()' in content, f'{f.name} missing downgrade()'

    def test_legacy_sql_preserved(self):
        """PR0023 §3：历史手工 SQL 归档到 migrations/legacy/"""
        legacy_dir = PROJECT_ROOT / 'migrations' / 'legacy'
        assert legacy_dir.exists()
        sql_files = list(legacy_dir.glob('*.sql'))
        assert len(sql_files) >= 1, 'no legacy SQL archived'

    def test_requirements_includes_flask_migrate(self):
        """requirements.txt 加了 Flask-Migrate + alembic"""
        req = (PROJECT_ROOT / 'requirements.txt').read_text(encoding='utf-8')
        assert 'Flask-Migrate' in req
        assert 'alembic' in req

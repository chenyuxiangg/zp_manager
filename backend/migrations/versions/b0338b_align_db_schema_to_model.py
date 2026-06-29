"""B0338b: align MySQL DB schema to current SQLAlchemy model

RR2 部署观察期发现真实根因：MySQL `zlearn_db.point_logs` 缺少 `related_task_id` /
`related_comment_id` / `operation` / `client_ip` / `user_agent` 5 列（PR0003 / PR0015
添加），`reminders` 表有遗留 `retry_count`（B0239 已声明废弃）+ 缺 `attempt_count` /
`next_retry_at`，`worker_runs` 表整体缺失（PR0001 cron 审计）。

**根因**：RR1 时期 MySQL DB 早于 RR2 baseline migration（05a05e23ee88）创建，
后续 PR0003 / B0239 / PR0006 等 schema 演进通过 SQL DDL 或 ORM 操作直接修改，
但 alembic_version 表从未被 stamp 到正确版本 — flask db upgrade 一直
"以为" DB 已在 head（实际表结构停留在 RR1），导致 PR0003 字段全员漂移。

**修复**：本 migration 用 `op.batch_alter_table` 幂等补齐缺失列/表/索引，
使 ORM 与 DB schema 对齐。任何后续 PR 改 model 时需配套出 migration —
RR3 backlog 加 alembic 自动化校验（CI 比较 model.metadata vs live DB）。

Revision ID: b0338b_align_db_schema_to_model
Revises: a1b2c3d4e5f6
Create Date: 2026-06-26 14:15:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b0338b_align_db_schema_to_model'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def _column_exists(table, column):
    """MySQL 兼容的列存在性检查（information_schema）"""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return column in {c['name'] for c in inspector.get_columns(table)}


def _table_exists(table):
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return inspector.has_table(table)


def upgrade():
    # ─── point_logs：补 PR0003 / PR0015 5 列 ───────────────────────
    # 注：使用 batch_alter_table 保证 MySQL DDL 兼容；nullable + 默认值让
    # 老数据迁移无需补值
    with op.batch_alter_table('point_logs', schema=None) as batch_op:
        if not _column_exists('point_logs', 'related_task_id'):
            batch_op.add_column(sa.Column('related_task_id', sa.BigInteger(), nullable=True))
        if not _column_exists('point_logs', 'related_comment_id'):
            batch_op.add_column(sa.Column('related_comment_id', sa.BigInteger(), nullable=True))
        if not _column_exists('point_logs', 'operation'):
            # enum 必须在 MySQL 上显式声明 DEFAULT 'award' 否则 INSERT 不带 operation 会失败
            batch_op.add_column(sa.Column(
                'operation',
                sa.Enum('award', 'refund', 'compute', name='point_log_operation'),
                nullable=False,
                server_default='award',
            ))
        if not _column_exists('point_logs', 'client_ip'):
            batch_op.add_column(sa.Column('client_ip', sa.String(length=45), nullable=True))
        if not _column_exists('point_logs', 'user_agent'):
            batch_op.add_column(sa.Column('user_agent', sa.String(length=255), nullable=True))

    # ─── reminders：B0239 替换 retry_count → attempt_count + next_retry_at ─
    # 老 retry_count 字段保留但 ORM 已不读 — 出于安全保守仅加新列、不强行 drop
    # （drop retry_count 是 RR3 backlog 项，需要先确认无遗留代码引用）
    with op.batch_alter_table('reminders', schema=None) as batch_op:
        if not _column_exists('reminders', 'attempt_count'):
            batch_op.add_column(sa.Column(
                'attempt_count', sa.Integer(), nullable=False, server_default='0',
            ))
        if not _column_exists('reminders', 'next_retry_at'):
            batch_op.add_column(sa.Column('next_retry_at', sa.DateTime(), nullable=True))

    # ─── worker_runs：PR0001 cron worker 审计表（缺失时 PR0001 worker 调度审计失效） ──
    if not _table_exists('worker_runs'):
        op.create_table(
            'worker_runs',
            sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column('job_name', sa.String(length=64), nullable=False),
            sa.Column('started_at', sa.DateTime(), nullable=False),
            sa.Column('finished_at', sa.DateTime(), nullable=True),
            sa.Column('picked', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('sent', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('failed', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('error', sa.Text(), nullable=True),
            sa.Column('host', sa.String(length=64), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint('id'),
        )


def downgrade():
    # 仅做 schema 回滚；不强制 drop 数据列（保守）
    if _table_exists('worker_runs'):
        op.drop_table('worker_runs')
    with op.batch_alter_table('reminders', schema=None) as batch_op:
        if _column_exists('reminders', 'next_retry_at'):
            batch_op.drop_column('next_retry_at')
        if _column_exists('reminders', 'attempt_count'):
            batch_op.drop_column('attempt_count')
    with op.batch_alter_table('point_logs', schema=None) as batch_op:
        if _column_exists('point_logs', 'user_agent'):
            batch_op.drop_column('user_agent')
        if _column_exists('point_logs', 'client_ip'):
            batch_op.drop_column('client_ip')
        if _column_exists('point_logs', 'operation'):
            batch_op.drop_column('operation')
        if _column_exists('point_logs', 'related_comment_id'):
            batch_op.drop_column('related_comment_id')
        if _column_exists('point_logs', 'related_task_id'):
            batch_op.drop_column('related_task_id')
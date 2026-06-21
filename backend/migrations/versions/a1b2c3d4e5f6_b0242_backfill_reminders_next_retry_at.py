"""B0242: backfill reminders.next_retry_at to NULL for legacy data

兜底 PR0001 老数据：RR1 reminders 表可能存在 next_retry_at IS NOT NULL 但实际
无"退避"语义（RR1 不存在该字段，PR0001 新加时是 NULL default）。该数据在
新 worker 逻辑下不会被重选（条件：next_retry_at IS NULL OR next_retry_at <= now）
— 已经是 NULL 的行 OK；但要确保非 NULL 老数据被规整为 NULL 兜底。

幂等：UPDATE … IS NULL 是 no-op。
"""
from alembic import op

revision = 'a1b2c3d4e5f6'
down_revision = '829dbe9246d9'
branch_labels = None
depends_on = None


def upgrade():
    # 6.3 B0242：幂等 backfill
    # 兼容 MySQL 8.0+ 与 SQLite
    op.execute("UPDATE reminders SET next_retry_at = NULL WHERE next_retry_at IS NOT NULL")


def downgrade():
    # 不可逆：回滚会丢失 RR1 老数据语义
    pass

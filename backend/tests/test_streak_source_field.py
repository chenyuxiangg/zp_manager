"""
6.2 B0229 修订 — StreakService source 字段语义修复

设计修复：
- StreakService.record_completion 加 source 参数（'record' | 'settle' | 'outbox'）
- sync fallback 默认 'record'，event_dispatcher 显式传 'outbox'
- 审计时 source 字段能区分三种来源
"""
import pytest
from datetime import date
from models import StreakLog
from services.streak import StreakService


class TestStreakSourceField:
    def test_record_completion_default_source_is_record(
        self, user, session
    ):
        """sync fallback 默认 source='record'"""
        today = date(2026, 6, 15)
        StreakService.record_completion(user.id, today)
        log = session.query(StreakLog).filter_by(
            user_id=user.id, log_date=today,
        ).first()
        assert log.source == 'record'

    def test_record_completion_with_outbox_source(
        self, user, session
    ):
        """6.2 B0229：dispatcher 显式传 source='outbox' 区分兜底路径"""
        today = date(2026, 6, 15)
        StreakService.record_completion(user.id, today, source='outbox')
        log = session.query(StreakLog).filter_by(
            user_id=user.id, log_date=today,
        ).first()
        assert log.source == 'outbox'

    def test_outbox_source_does_not_overwrite_record(
        self, user, session
    ):
        """sync 写 source='record' 后，outbox 二次调不应覆盖为 'outbox'"""
        today = date(2026, 6, 15)
        # sync fallback 写
        StreakService.record_completion(user.id, today, source='record')
        # outbox 兜底（同 task 同一 user，record_count 限 2 但 source 保留首个）
        # 这里调整语义：第二个调用是 outbox 兜底时，不应回写 source='outbox'
        # 但 fence 会跳过 2nd 调用，所以这里验证 source 仍为 'record'
        StreakService.record_completion(user.id, today, source='outbox')
        log = session.query(StreakLog).filter_by(
            user_id=user.id, log_date=today,
        ).first()
        # 第一个 source 保留（已有 row 时不更新 source）
        assert log.source == 'record'

    def test_outbox_first_call_uses_outbox_source(
        self, user, session
    ):
        """跨 worker 场景：仅 outbox 路径，source='outbox'"""
        today = date(2026, 6, 15)
        StreakService.record_completion(user.id, today, source='outbox')
        log = session.query(StreakLog).filter_by(
            user_id=user.id, log_date=today,
        ).first()
        assert log.source == 'outbox'

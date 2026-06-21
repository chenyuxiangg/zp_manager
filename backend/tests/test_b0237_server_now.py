"""
6.4 B0237 TDD — server_now() + tz sanity check

设计目标：
- server_now() 返回 server-local naive datetime（与 DB created_at 语义一致）
- server_today() 返回 server-local date（与 task.scheduled_date 语义一致）
- check_server_timezone_on_startup() 启动时打 log（不阻断）
"""
import pytest
from datetime import datetime, date
from utils import server_now, server_today, SERVER_TIMEZONE


class TestServerNowHelper:
    def test_server_now_returns_naive_datetime(self):
        """server_now() 返回 naive datetime（无 tzinfo）"""
        result = server_now()
        assert isinstance(result, datetime)
        assert result.tzinfo is None

    def test_server_now_close_to_datetime_now(self):
        """server_now() 与 datetime.now() 数值接近"""
        from datetime import datetime as dt
        before = dt.now()
        actual = server_now()
        after = dt.now()
        # server_now 应在 before/after 之间
        assert before <= actual <= after

    def test_server_today_returns_date(self):
        """server_today() 返回 date"""
        result = server_today()
        assert isinstance(result, date)


class TestTimezoneConstant:
    def test_server_timezone_default(self):
        """SERVER_TIMEZONE 默认 'server-local'"""
        assert isinstance(SERVER_TIMEZONE, str)
        assert SERVER_TIMEZONE  # 非空

    def test_check_server_timezone_on_startup_logs(self, app, caplog):
        """启动时 sanity check 写 log（不抛错）"""
        import logging
        from utils import check_server_timezone_on_startup
        with app.app_context():
            with caplog.at_level(logging.INFO):
                # 不应抛错
                check_server_timezone_on_startup(app)
        # 验证 log 至少包含 'B0237'
        assert any('B0237' in record.message for record in caplog.records)

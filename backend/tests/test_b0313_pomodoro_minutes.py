"""
B0313 — Pomodoro start 接受 planned_minutes 自定义时长

修复要点：
- 后端 start_pomodoro 接受 body.planned_minutes（int 1-180）
- 写入 PomodoroSession.planned_minutes 字段
- 默认 25（向后兼容，无 body 不报错）
- 非法值返 400 INVALID_INPUT
"""
import pytest


def _code(body):
    if 'code' in body:
        return body['code']
    if isinstance(body.get('error'), dict):
        return body['error'].get('code')
    return None


class TestB0313PomodoroPlannedMinutes:
    def test_custom_minutes_45(self, client, auth_headers, user, task, session):
        """【custom minutes】body.planned_minutes=45 → DB row.planned_minutes=45"""
        from models import PomodoroSession
        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/start',
            headers=auth_headers,
            json={'planned_minutes': 45},
        )
        assert res.status_code in (200, 201)
        data = res.get_json()['data']
        assert data['planned_minutes'] == 45
        sid = data['session_id']
        s = session.query(PomodoroSession).filter_by(id=sid).first()
        assert s is not None
        assert s.planned_minutes == 45

    def test_default_minutes_without_body(
        self, client, auth_headers, user, task, session
    ):
        """【default minutes】无 body 字段 → 默认 25（向后兼容）"""
        from models import PomodoroSession
        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/start',
            headers=auth_headers,
        )
        assert res.status_code in (200, 201)
        data = res.get_json()['data']
        assert data['planned_minutes'] == 25
        sid = data['session_id']
        s = session.query(PomodoroSession).filter_by(id=sid).first()
        assert s.planned_minutes == 25

    def test_minutes_180_boundary_ok(
        self, client, auth_headers, user, task
    ):
        """【boundary】planned_minutes=180 → 200（边界值合法）"""
        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/start',
            headers=auth_headers,
            json={'planned_minutes': 180},
        )
        assert res.status_code in (200, 201)
        assert res.get_json()['data']['planned_minutes'] == 180

    def test_minutes_200_rejected(
        self, client, auth_headers, user, task
    ):
        """【invalid】planned_minutes=200 → 400 INVALID_INPUT（防 DoS）"""
        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/start',
            headers=auth_headers,
            json={'planned_minutes': 200},
        )
        assert res.status_code == 400
        assert _code(res.get_json()) == 'INVALID_INPUT'

    def test_minutes_zero_rejected(
        self, client, auth_headers, user, task
    ):
        """【invalid】planned_minutes=0 → 400 INVALID_INPUT"""
        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/start',
            headers=auth_headers,
            json={'planned_minutes': 0},
        )
        assert res.status_code == 400
        assert _code(res.get_json()) == 'INVALID_INPUT'

    def test_minutes_negative_rejected(
        self, client, auth_headers, user, task
    ):
        """【invalid】planned_minutes=-10 → 400 INVALID_INPUT"""
        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/start',
            headers=auth_headers,
            json={'planned_minutes': -10},
        )
        assert res.status_code == 400
        assert _code(res.get_json()) == 'INVALID_INPUT'

    def test_minutes_string_rejected(
        self, client, auth_headers, user, task
    ):
        """【invalid】planned_minutes="50"（字符串）→ 400 INVALID_INPUT"""
        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/start',
            headers=auth_headers,
            json={'planned_minutes': '50'},
        )
        assert res.status_code == 400
        assert _code(res.get_json()) == 'INVALID_INPUT'

    def test_minutes_float_rejected(
        self, client, auth_headers, user, task
    ):
        """【invalid】planned_minutes=25.5（浮点）→ 400 INVALID_INPUT"""
        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/start',
            headers=auth_headers,
            json={'planned_minutes': 25.5},
        )
        assert res.status_code == 400
        assert _code(res.get_json()) == 'INVALID_INPUT'
"""
PR0021 TDD — Pomodoro 纯计时器（无积分联动）

设计（PR0021 §3-4）：
- POST /api/tasks/<id>/pomodoro/start → {session_id, started_at, planned_minutes}
- POST /api/tasks/<id>/pomodoro/<session_id>/end body {early_end} → 完成/未完成
- GET /api/tasks/<id>/pomodoros → 历史专注记录
- 同一 task 重复 start → 409 POMODORO_ALREADY_RUNNING
"""
import pytest
from datetime import datetime
from models import PomodoroSession, Task


def _code(body):
    if 'code' in body:
        return body['code']
    if isinstance(body.get('error'), dict):
        return body['error'].get('code')
    return None


class TestPomodoroStart:
    def test_start_returns_session_id(
        self, client, auth_headers, user, task, session
    ):
        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/start',
            headers=auth_headers,
        )
        assert res.status_code in (200, 201)
        data = res.get_json()['data']
        assert 'session_id' in data
        assert data['planned_minutes'] == 25

    def test_start_creates_db_row(
        self, client, auth_headers, user, task, session
    ):
        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/start',
            headers=auth_headers,
        )
        session_id = res.get_json()['data']['session_id']
        s = session.query(PomodoroSession).filter_by(id=session_id).first()
        assert s is not None
        assert s.user_id == user.id
        assert s.task_id == task.id
        assert s.ended_at is None
        assert s.completed is False

    def test_double_start_same_task_returns_409(
        self, client, auth_headers, task
    ):
        """B0203：同 task 已有 active session → 409"""
        r1 = client.post(
            f'/api/tasks/{task.id}/pomodoro/start', headers=auth_headers,
        )
        assert r1.status_code in (200, 201)

        r2 = client.post(
            f'/api/tasks/{task.id}/pomodoro/start', headers=auth_headers,
        )
        assert r2.status_code == 409
        assert _code(r2.get_json()) == 'POMODORO_ALREADY_RUNNING'

    def test_start_other_users_task_returns_403(
        self, client, auth_headers, other_user, stage, session
    ):
        """D7：跨用户 task 403"""
        from datetime import date
        bob_task = Task(
            user_id=other_user.id, stage_id=stage.id, title='bob',
            scheduled_date=date.today(), points=10, status='pending',
        )
        session.add(bob_task); session.commit()

        res = client.post(
            f'/api/tasks/{bob_task.id}/pomodoro/start', headers=auth_headers,
        )
        assert res.status_code == 403


class TestPomodoroEnd:
    def test_end_marks_completed_on_full_25min(
        self, client, auth_headers, user, task, session
    ):
        r = client.post(
            f'/api/tasks/{task.id}/pomodoro/start', headers=auth_headers,
        )
        sid = r.get_json()['data']['session_id']
        # 手动改 started_at 模拟 25 分钟前
        s = session.query(PomodoroSession).filter_by(id=sid).first()
        from datetime import datetime, timedelta
        s.started_at = datetime.utcnow() - timedelta(minutes=26)
        session.commit()

        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/{sid}/end',
            headers=auth_headers, json={'early_end': False},
        )
        assert res.status_code == 200
        session.refresh(s)
        assert s.completed is True
        assert s.ended_at is not None

    def test_end_early_marks_not_completed(
        self, client, auth_headers, user, task, session
    ):
        r = client.post(
            f'/api/tasks/{task.id}/pomodoro/start', headers=auth_headers,
        )
        sid = r.get_json()['data']['session_id']

        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/{sid}/end',
            headers=auth_headers, json={'early_end': True},
        )
        assert res.status_code == 200
        s = session.query(PomodoroSession).filter_by(id=sid).first()
        assert s.completed is False

    def test_end_does_NOT_auto_toggle_task(
        self, client, auth_headers, user, task, session
    ):
        """PR0021 关键差异：纯计时器不联动 task.toggle"""
        r = client.post(
            f'/api/tasks/{task.id}/pomodoro/start', headers=auth_headers,
        )
        sid = r.get_json()['data']['session_id']
        s = session.query(PomodoroSession).filter_by(id=sid).first()
        from datetime import datetime, timedelta
        s.started_at = datetime.utcnow() - timedelta(minutes=26)
        session.commit()

        client.post(
            f'/api/tasks/{task.id}/pomodoro/{sid}/end',
            headers=auth_headers, json={'early_end': False},
        )
        # task 状态保持 pending（PR0021 边界）
        session.refresh(task)
        assert task.status == 'pending'


class TestPomodoroList:
    def test_list_returns_history(
        self, client, auth_headers, user, task, session
    ):
        # 1 个已结束 + 1 个进行中
        from datetime import datetime, timedelta
        s1 = PomodoroSession(
            user_id=user.id, task_id=task.id,
            started_at=datetime.utcnow() - timedelta(minutes=30),
            ended_at=datetime.utcnow() - timedelta(minutes=5),
            planned_minutes=25, actual_seconds=25*60,
            completed=True,
        )
        s2 = PomodoroSession(
            user_id=user.id, task_id=task.id,
            started_at=datetime.utcnow(),
            planned_minutes=25,
        )
        session.add_all([s1, s2]); session.commit()

        res = client.get(
            f'/api/tasks/{task.id}/pomodoros', headers=auth_headers,
        )
        assert res.status_code == 200
        sessions = res.get_json()['data']['pomodoros']
        assert len(sessions) == 2
        # 按 started_at 倒序
        assert sessions[0]['started_at'] >= sessions[1]['started_at']

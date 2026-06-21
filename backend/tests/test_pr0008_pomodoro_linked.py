"""
PR0008 TDD — Pomodoro 联动版（auto_toggle + 积分联动）

设计（PR0008 §1-7）：
- end 端点接受 {auto_toggle: bool}，completed=true 时自动 toggle task
- auto_toggle 调 PointsService.award(source='pomodoro_auto_toggle') 走 rate_guard 白名单
- 25min 完成后：task.status='completed'，user.points += 10，pomodoro_sessions.auto_toggled=True
- 已 completed 的 task：auto_toggle 无效（race condition 处理）
"""
import pytest
from datetime import datetime, timedelta
from models import Task, PomodoroSession, PointLog


# B0331：测试 toggle 撤销行为时需绕过 30min rate_guard
@pytest.fixture
def bypass_rate_guard(monkeypatch):
    from services.rate_guard import RateGuard
    monkeypatch.setattr(RateGuard, 'can_toggle',
                        staticmethod(lambda *a, **kw: (True, 0)))


def _code(body):
    if 'code' in body:
        return body['code']
    if isinstance(body.get('error'), dict):
        return body['error'].get('code')
    return None


class TestPomodoroLinkedToggle:
    def test_end_with_auto_toggle_completes_task_and_awards(
        self, client, auth_headers, user, task, session
    ):
        """25min 完成 + auto_toggle=true → task 标 completed + user.points += 10"""
        user.points = 0
        session.commit()
        # 启动
        r = client.post(
            f'/api/tasks/{task.id}/pomodoro/start', headers=auth_headers,
        )
        sid = r.get_json()['data']['session_id']
        # 把 started_at 改为 26 分钟前（模拟 25min 完整跑完）
        s = session.query(PomodoroSession).filter_by(id=sid).first()
        s.started_at = datetime.utcnow() - timedelta(minutes=26)
        session.commit()

        # end with auto_toggle
        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/{sid}/end',
            headers=auth_headers, json={'auto_toggle': True, 'early_end': False},
        )
        assert res.status_code == 200
        session.refresh(task)
        session.refresh(user)
        assert task.status == 'completed'
        assert user.points == 10
        # auto_toggled 标记
        session.refresh(s)
        assert s.auto_toggled is True
        # PointLog 落库
        log = session.query(PointLog).filter_by(
            user_id=user.id, task_id=task.id, operation='award',
        ).first()
        assert log is not None
        assert log.reason == 'pomodoro_auto_toggle'

    def test_end_with_auto_toggle_bypasses_rate_guard(
        self, client, auth_headers, user, task, session, bypass_rate_guard
    ):
        """pomodoro_auto_toggle source 走 rate_guard 白名单（30 分钟内不拦）

        B0331：setup 阶段需要先 toggle 完成 + 撤销来准备初始状态；
        撤销分支现在被 rate_guard 拦截（这是 PR0003 §6 新行为），所以用
        bypass_rate_guard fixture mock 掉 RateGuard，让撤销走真实逻辑。
        """
        # 先用手动 toggle 完成 task（创建 award log 占用 30min 窗口）
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        # 撤销（用 refund 释放窗口，task 回到 pending）
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        session.refresh(task)
        assert task.status == 'pending'
        session.refresh(user)
        user.points = 0
        session.commit()

        # 开 pomodoro session
        r = client.post(
            f'/api/tasks/{task.id}/pomodoro/start', headers=auth_headers,
        )
        sid = r.get_json()['data']['session_id']
        s = session.query(PomodoroSession).filter_by(id=sid).first()
        s.started_at = datetime.utcnow() - timedelta(minutes=26)
        session.commit()

        # end + auto_toggle：因 source='pomodoro_auto_toggle'，rate_guard 不拦
        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/{sid}/end',
            headers=auth_headers, json={'auto_toggle': True, 'early_end': False},
        )
        assert res.status_code == 200
        session.refresh(task)
        assert task.status == 'completed'

    def test_end_auto_toggle_on_already_completed_task_no_op(
        self, client, auth_headers, user, task, session
    ):
        """B0019：已 completed 的 task 开始专注 → auto_toggle 无效"""
        # 先手动 toggle 完成
        client.patch(f'/api/tasks/{task.id}/toggle', headers=auth_headers)
        session.refresh(task)
        assert task.status == 'completed'
        user.points = 10
        session.commit()

        # 开 pomodoro（注意：已 completed task 开 session 仍允许，但 B0019 要求 auto_toggle 短路）
        r = client.post(
            f'/api/tasks/{task.id}/pomodoro/start', headers=auth_headers,
        )
        sid = r.get_json()['data']['session_id']
        s = session.query(PomodoroSession).filter_by(id=sid).first()
        s.started_at = datetime.utcnow() - timedelta(minutes=26)
        session.commit()

        # end + auto_toggle：应无效（task 已是 completed，幂等）
        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/{sid}/end',
            headers=auth_headers, json={'auto_toggle': True, 'early_end': False},
        )
        assert res.status_code == 200
        # 积分不变（auto_toggle 短路）
        session.refresh(user)
        assert user.points == 10

    def test_end_early_does_NOT_auto_toggle(
        self, client, auth_headers, user, task, session
    ):
        """early_end=true → auto_toggle 仍无效（completed=false）"""
        r = client.post(
            f'/api/tasks/{task.id}/pomodoro/start', headers=auth_headers,
        )
        sid = r.get_json()['data']['session_id']
        user.points = 0
        session.commit()

        res = client.post(
            f'/api/tasks/{task.id}/pomodoro/{sid}/end',
            headers=auth_headers, json={'auto_toggle': True, 'early_end': True},
        )
        assert res.status_code == 200
        session.refresh(task)
        assert task.status == 'pending'  # 没自动完成
        session.refresh(user)
        assert user.points == 0

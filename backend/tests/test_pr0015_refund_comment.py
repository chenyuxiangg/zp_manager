"""
PR0015 TDD — 评论积分可撤销

设计（PR0015 §1-5）：
- DELETE 评论 → 写 PointLog(reason='comment_revoked', delta=-2)
- 已有 award log（related_comment_id）才扣；老数据无 related_comment_id 时不扣（向后兼容）
- 重复删幂等
- 非 owner 删返 403
- 跨用户删除保留 403（攻击者不能让别人扣分）
"""
import pytest
from datetime import datetime
from models import Comment, PointLog


def _code(body):
    if 'code' in body:
        return body['code']
    if isinstance(body.get('error'), dict):
        return body['error'].get('code')
    return None


def _make_comment_with_award(user, task, session, content='cmt'):
    """工厂：构造 comment + 配套 award log（related_comment_id 已关联）"""
    c = Comment(task_id=task.id, user_id=user.id, content=content)
    session.add(c); session.commit()
    pl = PointLog(
        user_id=user.id, task_id=task.id,
        delta=2, reason='comment_added', operation='award',
        related_comment_id=c.id, related_task_id=task.id,
    )
    session.add(pl); session.commit()
    return c


class TestRefundComment:
    def test_delete_own_comment_writes_refund_log(
        self, client, auth_headers, user, task, session
    ):
        """删自己评论 → 写 PointLog reason=comment_revoked delta=-2"""
        c = _make_comment_with_award(user, task, session)
        user.points = 10
        session.commit()
        res = client.delete(
            f'/api/tasks/{c.task_id}/comments/{c.id}',
            headers=auth_headers,
        )
        assert res.status_code == 200
        refund_log = (
            session.query(PointLog)
            .filter_by(user_id=user.id, reason='comment_revoked')
            .first()
        )
        assert refund_log is not None
        assert refund_log.delta == -2
        assert refund_log.related_comment_id == c.id

    def test_delete_own_comment_deducts_2_points(
        self, client, auth_headers, user, task, session
    ):
        c = _make_comment_with_award(user, task, session)
        user.points = 10
        session.commit()
        client.delete(
            f'/api/tasks/{c.task_id}/comments/{c.id}',
            headers=auth_headers,
        )
        session.refresh(user)
        assert user.points == 8

    def test_delete_other_user_comment_returns_403(
        self, client, auth_headers, user, other_user, task, session
    ):
        """D7：非 owner 删 403，且 user.points 不变"""
        c = Comment(
            task_id=task.id, user_id=other_user.id, content='bob-cmt',
        )
        session.add(c); session.commit()

        user.points = 10
        session.commit()
        res = client.delete(
            f'/api/tasks/{task.id}/comments/{c.id}',
            headers=auth_headers,
        )
        assert res.status_code == 403
        assert _code(res.get_json()) == 'NOT_OWNER'
        # 攻击者不能让别人扣分
        session.refresh(user)
        assert user.points == 10

    def test_delete_legacy_comment_without_related_id_no_refund(
        self, client, auth_headers, user, task, session
    ):
        """B0046：老数据无 related_comment_id 不扣分（向后兼容）"""
        c = Comment(
            task_id=task.id, user_id=user.id, content='legacy',
        )
        session.add(c); session.commit()
        # 老数据：award log 没有 related_comment_id
        pl = PointLog(
            user_id=user.id, task_id=task.id, delta=2,
            reason='comment_added', operation='award',
            related_comment_id=None,  # 老数据关键：无关联
        )
        session.add(pl); session.commit()

        user.points = 10
        session.commit()
        res = client.delete(
            f'/api/tasks/{c.task_id}/comments/{c.id}',
            headers=auth_headers,
        )
        assert res.status_code == 200
        # user.points 不应被扣
        session.refresh(user)
        assert user.points == 10

    def test_double_delete_is_idempotent(
        self, client, auth_headers, user, task, session
    ):
        """重复删同一评论：第二次不重复扣分"""
        c = _make_comment_with_award(user, task, session)
        user.points = 10
        session.commit()
        # 第一次删
        r1 = client.delete(
            f'/api/tasks/{c.task_id}/comments/{c.id}',
            headers=auth_headers,
        )
        assert r1.status_code == 200
        session.refresh(user)
        assert user.points == 8

        # 第二次删：comment 已不存在 → 404
        r2 = client.delete(
            f'/api/tasks/{c.task_id}/comments/{c.id}',
            headers=auth_headers,
        )
        # 404 (comment not found) - 不再扣分
        assert r2.status_code in (404, 200)
        # 若 200（幂等成功），user.points 不应再变
        if r2.status_code == 200:
            session.refresh(user)
            assert user.points == 8

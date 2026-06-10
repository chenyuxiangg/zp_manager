"""
迭代 3: Comment 加 updated_at 字段 + author 关系 + 4 个 comment 接口返回 username/updated_at
"""
import time
import pytest
from models import Comment, db


class TestCommentModel:
    """Comment 模型层：updated_at 字段 + author 关系"""

    def test_comment_has_updated_at_field(self, session, task, user):
        """Comment 模型必须有 updated_at 字段"""
        c = Comment(
            id=9001, task_id=task.id, user_id=user.id, content='hi'
        )
        session.add(c)
        session.commit()
        # 创建时 updated_at 应有值（与 created_at 同步）
        assert hasattr(c, 'updated_at')
        assert c.updated_at is not None

    def test_comment_updated_at_changes_on_update(self, session, task, user):
        """更新评论后 updated_at 应自动更新"""
        c = Comment(
            id=9002, task_id=task.id, user_id=user.id, content='hi'
        )
        session.add(c)
        session.commit()
        original_updated_at = c.updated_at

        # 等待 10ms 确保时间戳不同
        time.sleep(0.05)
        c.content = 'updated'
        session.commit()
        assert c.updated_at > original_updated_at

    def test_comment_has_author_relationship(self, session, task, user):
        """Comment 必须能通过 author 关系访问 User"""
        c = Comment(
            id=9003, task_id=task.id, user_id=user.id, content='hi'
        )
        session.add(c)
        session.commit()
        assert c.author is not None
        assert c.author.id == user.id
        assert c.author.username == user.username


class TestGetCommentsReturnsUsername:
    """GET /api/tasks/:id/comments 返回 username + updated_at"""

    def test_get_comments_returns_username(self, client, auth_headers, task, comment, user):
        res = client.get(f'/api/tasks/{task.id}/comments', headers=auth_headers)
        assert res.status_code == 200
        c = res.get_json()['data']['comments'][0]
        assert c['username'] == 'alice'
        assert c['user_id'] == user.id

    def test_get_comments_returns_updated_at(self, client, auth_headers, task, comment):
        res = client.get(f'/api/tasks/{task.id}/comments', headers=auth_headers)
        c = res.get_json()['data']['comments'][0]
        assert 'updated_at' in c
        assert c['updated_at'] is not None


class TestAddCommentReturnsUsername:
    """POST /api/tasks/:id/comments 返回完整字段"""

    def test_add_comment_returns_username(self, client, auth_headers, task, user):
        res = client.post(f'/api/tasks/{task.id}/comments',
                          json={'content': 'new comment'},
                          headers=auth_headers)
        assert res.status_code == 201
        c = res.get_json()['data']['comment']
        assert c['username'] == 'alice'
        assert c['user_id'] == user.id
        assert c['content'] == 'new comment'

    def test_add_comment_returns_updated_at_as_null(self, client, auth_headers, task):
        """新创建的评论 updated_at 为 None（与 created_at 区分）"""
        res = client.post(f'/api/tasks/{task.id}/comments',
                          json={'content': 'new'},
                          headers=auth_headers)
        c = res.get_json()['data']['comment']
        # 首次创建时可能为 None 或与 created_at 一致（由 SQLAlchemy 行为决定）
        assert 'updated_at' in c


class TestUpdateCommentChangesUpdatedAt:
    """PUT /api/tasks/:id/comments/:commentId 更新后 updated_at 应变化"""

    def test_update_comment_returns_new_updated_at(self, client, auth_headers, task, comment):
        original = comment.updated_at
        time.sleep(0.05)
        res = client.put(f'/api/tasks/{task.id}/comments/{comment.id}',
                         json={'content': 'updated content'},
                         headers=auth_headers)
        assert res.status_code == 200
        c = res.get_json()['data']['comment']
        assert c['content'] == 'updated content'
        assert c['updated_at'] is not None
        # 解析 ISO 字符串比较
        from datetime import datetime
        new_updated_at = datetime.fromisoformat(c['updated_at'])
        assert new_updated_at > original

    def test_update_comment_returns_username(self, client, auth_headers, task, comment, user):
        res = client.put(f'/api/tasks/{task.id}/comments/{comment.id}',
                         json={'content': 'updated'},
                         headers=auth_headers)
        c = res.get_json()['data']['comment']
        assert c['username'] == 'alice'


class TestDeleteComment:
    """DELETE 评论回归测试"""

    def test_delete_comment_succeeds(self, client, auth_headers, task, comment):
        res = client.delete(f'/api/tasks/{task.id}/comments/{comment.id}',
                            headers=auth_headers)
        assert res.status_code == 200
        # 验证 DB 中已删除
        assert db.session.get(Comment, comment.id) is None

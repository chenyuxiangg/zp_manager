"""
pytest fixtures for backend integration tests.

使用 SQLite in-memory 数据库做测试（速度快、隔离性好）。
生产环境使用 MySQL，但业务逻辑层面 SQLite 兼容。
"""
import os
import sys
import pytest
from datetime import date, datetime, timedelta

# 确保 backend 根目录在 Python 路径中
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# 必须在 import models 之前设置环境变量，让 Config 加载
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ.setdefault('SECRET_KEY', 'test-secret-key')
os.environ.setdefault('JWT_SECRET_KEY', 'test-jwt-secret-key')
# 邮件配置（部分启动流程可能引用）
os.environ.setdefault('MAIL_SERVER', 'smtp.test.com')

from app import create_app  # noqa: E402
from models import db, User, Plan, Stage, Task, Comment, PointLog  # noqa: E402
from utils import generate_token  # noqa: E402


@pytest.fixture
def app():
    """创建测试 app 实例，使用 SQLite 内存数据库"""
    flask_app = create_app()
    flask_app.config['TESTING'] = True
    flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'

    with flask_app.app_context():
        db.create_all()
        yield flask_app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    """Flask test client"""
    return app.test_client()


@pytest.fixture
def session(app):
    """数据库 session（避免与 db 模型对象命名冲突）"""
    return db.session


# --- ID 计数器：解决 SQLite 不支持 BigInteger autoincrement ---
_id_counter = {'n': 0}


def _next_id():
    _id_counter['n'] += 1
    return _id_counter['n']


@pytest.fixture(autouse=True)
def reset_id_counter():
    """每个测试重置 id 计数器"""
    _id_counter['n'] = 0


@pytest.fixture
def user(app, session):
    """普通测试用户 alice"""
    u = User(id=_next_id(), username='alice', email='alice@test.com', points=0)
    u.set_password('password123')
    session.add(u)
    session.commit()
    return u


@pytest.fixture
def other_user(app, session):
    """另一个用户 bob，用于权限隔离测试"""
    u = User(id=_next_id(), username='bob', email='bob@test.com', points=0)
    u.set_password('password456')
    session.add(u)
    session.commit()
    return u


@pytest.fixture
def auth_headers(user):
    """alice 的 JWT 认证头"""
    token, _, _ = generate_token(user.id)
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def other_auth_headers(other_user):
    """bob 的 JWT 认证头"""
    token, _, _ = generate_token(other_user.id)
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture
def plan(user, session):
    """alice 的学习计划"""
    p = Plan(
        id=_next_id(),
        user_id=user.id,
        title='P1',
        description='plan desc',
        start_date=date.today(),
        end_date=date.today() + timedelta(days=30),
        status='active',
    )
    session.add(p)
    session.commit()
    return p


@pytest.fixture
def stage(plan, session):
    """alice 的学习阶段"""
    s = Stage(
        id=_next_id(),
        plan_id=plan.id,
        title='S1',
        description='stage desc',
        order_num=1,
        start_date=date.today(),
        end_date=date.today() + timedelta(days=10),
        status='pending',
    )
    session.add(s)
    session.commit()
    return s


@pytest.fixture
def task(user, stage, session):
    """alice 的 pending 任务"""
    t = Task(
        id=_next_id(),
        user_id=user.id,
        stage_id=stage.id,
        title='T1',
        description='task desc',
        scheduled_date=date.today(),
        points=10,
        status='pending',
    )
    session.add(t)
    session.commit()
    return t


@pytest.fixture
def completed_task(user, stage, session):
    """alice 的已完成任务"""
    t = Task(
        id=_next_id(),
        user_id=user.id,
        stage_id=stage.id,
        title='Done',
        scheduled_date=date.today(),
        points=10,
        status='completed',
        completed_at=datetime.utcnow(),
    )
    session.add(t)
    session.commit()
    return t


@pytest.fixture
def comment(task, user, session):
    """alice 在 task 上的评论"""
    c = Comment(
        id=_next_id(),
        task_id=task.id,
        user_id=user.id,
        content='hello world',
    )
    session.add(c)
    session.commit()
    return c

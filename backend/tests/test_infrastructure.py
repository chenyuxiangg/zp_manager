"""Smoke test: verify test infrastructure works."""
from models import User


def test_user_fixture_creates_user(user, session):
    """Fixture should create a user in DB"""
    assert user.id is not None
    assert user.username == 'alice'
    assert user.email == 'alice@test.com'
    assert session.query(User).count() == 1


def test_password_is_hashed(user):
    """Password should be hashed, not stored plain"""
    assert user.password_hash != 'password123'
    assert user.check_password('password123') is True
    assert user.check_password('wrong') is False


def test_plan_stage_task_fixtures_chain(plan, stage, task, session):
    """plan → stage → task hierarchy should be properly linked"""
    assert plan.id is not None
    assert stage.plan_id == plan.id
    assert task.stage_id == stage.id
    assert task.user_id == plan.user_id

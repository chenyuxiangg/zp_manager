import os
import secrets


def _required_env(name: str) -> str:
    """读取必填环境变量；缺失时直接抛出（fail-fast，不允许 fallback 写死）。"""
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(
            f"[Config] FATAL: environment variable {name!r} is required. "
            f"Set it in backend/.env (see .env.example) or in your deployment platform's secret store."
        )
    return value


def _optional_env(name: str, default: str) -> str:
    """读取可选环境变量。"""
    return os.environ.get(name, default)


class Config:
    # ---- 必填：密钥与数据库 ----
    # 不允许 fallback 写死字符串（防止随源码泄露后被反编译直接伪造 JWT / 直连 DB）
    SECRET_KEY = _required_env('SECRET_KEY')
    JWT_SECRET_KEY = _required_env('JWT_SECRET_KEY')
    SQLALCHEMY_DATABASE_URI = _required_env('DATABASE_URL')

    # ---- Flask / SQLAlchemy ----
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }

    # ---- 可选：CORS / 前端 URL ----
    CORS_ORIGINS = _optional_env('CORS_ORIGINS', 'http://localhost:5173,http://localhost:8080')
    FRONTEND_URL = _optional_env('FRONTEND_URL', 'http://localhost:5173')

    # ---- JWT 有效期 ----
    JWT_ACCESS_TOKEN_EXPIRES = 86400 * 7  # 7 天

    # ---- 邮件（可选；密码重置需要，缺失时该功能降级为日志输出）----
    MAIL_SERVER = _optional_env('MAIL_SERVER', '')
    MAIL_PORT = int(_optional_env('MAIL_PORT', '587'))
    MAIL_USE_TLS = _optional_env('MAIL_USE_TLS', 'true').lower() == 'true'
    MAIL_USERNAME = _optional_env('MAIL_USERNAME', '')
    MAIL_PASSWORD = _optional_env('MAIL_PASSWORD', '')
    MAIL_DEFAULT_SENDER = _optional_env('MAIL_DEFAULT_SENDER', 'noreply@example.com')


class TestConfig(Config):
    """测试用：覆盖必填项，提供 SQLite 内存数据库 + 随机密钥（每次启动不同，足够安全）"""
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    SECRET_KEY = 'test-secret-' + secrets.token_hex(16)
    JWT_SECRET_KEY = 'test-jwt-' + secrets.token_hex(16)
    # 测试时禁用邮件
    MAIL_SERVER = ''
    MAIL_USERNAME = ''
    MAIL_PASSWORD = ''
    MAIL_DEFAULT_SENDER = ''

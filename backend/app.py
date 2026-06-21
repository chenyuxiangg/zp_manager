from flask import Flask
from flask_cors import CORS
from flask_mail import Mail
from flask_migrate import Migrate  # PR0023
from config import Config
from models import db
from routes import register_blueprints
from services.reminder import mail


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    allowed_origins = [origin.strip() for origin in app.config['CORS_ORIGINS'].split(',') if origin.strip()]
    CORS(app, resources={r"/api/*": {"origins": allowed_origins, "supports_credentials": True}})

    db.init_app(app)
    mail.init_app(app)
    # PR0023：Alembic 迁移接入（基线 + 后续 schema 变更走 flask db migrate）
    Migrate(app, db)

    # 6.4 B0237：启动时检查服务器时区（log 形式，便于运维确认）
    from utils import check_server_timezone_on_startup
    with app.app_context():
        check_server_timezone_on_startup(app)

    register_blueprints(app)

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
from flask import Flask
from flask_cors import CORS
from flask_mail import Mail
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

    register_blueprints(app)

    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)
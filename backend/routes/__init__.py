from flask import Blueprint

auth_bp = None
plans_bp = None
stages_bp = None
tasks_bp = None
reports_bp = None
users_bp = None
templates_bp = None
admin_bp = None


def register_blueprints(app):
    global auth_bp, plans_bp, stages_bp, tasks_bp, reports_bp, users_bp, templates_bp, admin_bp

    from .auth import auth_bp
    from .plans import plans_bp
    from .stages import stages_bp
    from .tasks import tasks_bp
    from .reports import reports_bp
    from .users import users_bp
    from .plan_templates import templates_bp
    from .admin import admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(plans_bp)
    app.register_blueprint(stages_bp)
    app.register_blueprint(tasks_bp)
    app.register_blueprint(reports_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(templates_bp)
    app.register_blueprint(admin_bp)
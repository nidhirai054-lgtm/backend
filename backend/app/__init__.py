from flask import Flask
from flask_cors import CORS
from mongoengine import connect

from app.config import get_config
from app.extensions import jwt, socketio, celery


def create_app():
    app = Flask(__name__)
    cfg = get_config()
    app.config.from_object(cfg)

    # --- Extensions ---
    CORS(app, resources={r"/api/*": {"origins": "*", "supports_credentials": True}})
    jwt.init_app(app)
    socketio.init_app(app)

    # --- JWT Error Handlers ---
    @jwt.unauthorized_loader
    def unauthorized_callback(callback):
        return {"error": "Missing or invalid token"}, 401

    @jwt.invalid_token_loader
    def invalid_token_callback(callback):
        return {"error": "Invalid token"}, 401

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return {"error": "Token has expired"}, 401

    # --- MongoDB ---
    connect(host=cfg.MONGO_URI)

    # --- Celery ---
    celery.conf.update(
        broker_url=cfg.CELERY_BROKER_URL,
        result_backend=cfg.CELERY_RESULT_BACKEND,
    )

    # --- Blueprints ---
    from app.api.auth.routes import auth_bp
    from app.api.rides.routes import rides_bp
    from app.api.chat.routes import chat_bp
    from app.api.voice.routes import voice_bp
    from app.api.safety.routes import safety_bp
    from app.api.community.routes import community_bp
    from app.api.dashboard.routes import dashboard_bp

    app.register_blueprint(auth_bp,      url_prefix="/api/auth")
    app.register_blueprint(rides_bp,     url_prefix="/api/rides")
    app.register_blueprint(chat_bp,      url_prefix="/api/chat")
    app.register_blueprint(voice_bp,     url_prefix="/api/voice")
    app.register_blueprint(safety_bp,    url_prefix="/api/safety")
    app.register_blueprint(community_bp, url_prefix="/api/community")
    app.register_blueprint(dashboard_bp, url_prefix="/api/dashboard")

    # --- Socket Events ---
    from app.sockets import events  # noqa: F401

    @app.route("/health")
    def health():
        return {"status": "ok", "service": "Smart Ride-Sharing API"}, 200

    return app

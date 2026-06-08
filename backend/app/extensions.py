from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from mongoengine import connect
from celery import Celery

jwt = JWTManager()
socketio = SocketIO(cors_allowed_origins="*", async_mode="threading")
celery = Celery(__name__)

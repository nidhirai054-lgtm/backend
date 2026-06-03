import pytest
from app import create_app


@pytest.fixture
def app():
    app = create_app()
    app.config["TESTING"] = True
    app.config["MONGO_URI"] = "mongodb://localhost:27017/rideshare_test"
    return app


@pytest.fixture
def client(app):
    return app.test_client()

def test_health(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json["status"] == "ok"


def test_register(client):
    res = client.post("/api/auth/register", json={
        "name": "Test User",
        "email": "test@presidency.edu.in",
        "password": "test1234",
        "role": "passenger",
        "gender": "female",
    })
    assert res.status_code in (201, 409)  # 409 if already exists


def test_login_invalid(client):
    res = client.post("/api/auth/login", json={
        "email": "nobody@example.com",
        "password": "wrongpass"
    })
    assert res.status_code == 401


def test_me_requires_auth(client):
    res = client.get("/api/auth/me")
    assert res.status_code == 401

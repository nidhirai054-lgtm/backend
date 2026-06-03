def test_chat_requires_auth(client):
    res = client.post("/api/chat/message", json={"message": "Hello"})
    assert res.status_code == 401


def test_safety_gps_requires_auth(client):
    res = client.post("/api/safety/gps-ping", json={})
    assert res.status_code == 401


def test_voice_requires_auth(client):
    res = client.post("/api/voice/process", json={"transcript": "Book a cab"})
    assert res.status_code == 401

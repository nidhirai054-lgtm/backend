def test_book_requires_auth(client):
    res = client.post("/api/rides/book", json={})
    assert res.status_code == 401


def test_list_rides_requires_auth(client):
    res = client.get("/api/rides/")
    assert res.status_code == 401

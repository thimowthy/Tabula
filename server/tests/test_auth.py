def test_register_then_me(client):
    resp = client.post("/auth/register", json={"username": "ana", "password": "correct-horse"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["user"]["username"] == "ana"
    assert body["token_type"] == "bearer"

    me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["username"] == "ana"


def test_register_duplicate_username_conflicts(client):
    client.post("/auth/register", json={"username": "ana", "password": "correct-horse"})
    resp = client.post("/auth/register", json={"username": "ana", "password": "another-password"})
    assert resp.status_code == 409


def test_register_rejects_short_password(client):
    resp = client.post("/auth/register", json={"username": "ana", "password": "short"})
    assert resp.status_code == 422


def test_login_succeeds_with_correct_password(client):
    client.post("/auth/register", json={"username": "ana", "password": "correct-horse"})
    resp = client.post("/auth/login", json={"username": "ana", "password": "correct-horse"})
    assert resp.status_code == 200
    assert resp.json()["user"]["username"] == "ana"


def test_login_rejects_wrong_password(client):
    client.post("/auth/register", json={"username": "ana", "password": "correct-horse"})
    resp = client.post("/auth/login", json={"username": "ana", "password": "wrong-password"})
    assert resp.status_code == 401


def test_login_rejects_unknown_username(client):
    resp = client.post("/auth/login", json={"username": "ghost", "password": "correct-horse"})
    assert resp.status_code == 401


def test_me_requires_a_token(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_me_rejects_garbage_token(client):
    resp = client.get("/auth/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert resp.status_code == 401

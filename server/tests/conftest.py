import os

# Must happen before `tabula_server.database` is imported anywhere (it reads
# this env var at module import time) — points the *global* engine used by
# the app's startup event at a location that isn't the real dev DB. The
# fixture below additionally overrides `get_db` per test with its own
# isolated in-memory engine, so this value is really just a safety net.
os.environ.setdefault("TABULA_DB_URL", "sqlite://")
os.environ.setdefault("TABULA_SECRET_KEY", "test-secret-key-at-least-32-bytes-long")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from tabula_server.database import Base, get_db
from tabula_server.main import app


@pytest.fixture()
def client():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


@pytest.fixture()
def auth_headers(client: TestClient):
    def _register(username: str = "ana", password: str = "correct-horse") -> dict[str, str]:
        resp = client.post("/auth/register", json={"username": username, "password": password})
        assert resp.status_code == 201, resp.text
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _register

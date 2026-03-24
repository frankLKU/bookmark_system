import pytest
import sqlite3
from fastapi.testclient import TestClient
from app.database import init_db, get_db
from app.main import app


@pytest.fixture(autouse=True)
def test_db(tmp_path):
    db_path = str(tmp_path / "test.db")
    init_db(db_path)
    def override_get_db():
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
        finally:
            conn.close()
    app.dependency_overrides[get_db] = override_get_db
    yield db_path
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def seed_category(client):
    resp = client.post("/api/v1/categories", json={"name": "Spark"})
    return resp.json()["data"]["id"]


@pytest.fixture
def seed_bookmark(client, seed_category):
    resp = client.post("/api/v1/bookmarks", json={
        "title": "Spark F18",
        "url": "https://spark-f18.tsmc.com",
        "category_id": seed_category,
        "tags": ["f18"],
    })
    return resp.json()["data"]["id"]

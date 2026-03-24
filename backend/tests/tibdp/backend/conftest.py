import sqlite3
import tempfile
import os
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db, init_db


def _make_test_db():
    tmp = tempfile.mktemp(suffix=".db")
    init_db(tmp)
    return tmp


def _get_test_db(db_path):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
    finally:
        conn.close()


@pytest.fixture
def client():
    db_path = _make_test_db()

    def override_get_db():
        yield from _get_test_db(db_path)

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    try:
        os.unlink(db_path)
    except OSError:
        pass


@pytest.fixture
def seed_category(client):
    resp = client.post("/api/v1/categories", json={"name": "Spark"})
    return resp.json()["data"]["id"]


@pytest.fixture
def seed_bookmark(client, seed_category):
    resp = client.post(
        "/api/v1/bookmarks",
        json={"title": "Test Bookmark", "url": "https://example.com", "category_id": seed_category},
    )
    return resp.json()["data"]["id"]

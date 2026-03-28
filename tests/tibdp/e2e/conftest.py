"""Playwright E2E test fixtures.

Starts a real FastAPI server on a random port, seeds data via REST,
and provides a Playwright page pointed at the running app.
"""

import socket
import sqlite3
import threading
import time
import uuid

import httpx
import pytest
import uvicorn


def _find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def app_port():
    return _find_free_port()


@pytest.fixture(scope="session")
def base_url(app_port):
    return f"http://127.0.0.1:{app_port}"


@pytest.fixture(scope="session")
def ws_url(app_port):
    return f"ws://127.0.0.1:{app_port}/ws/chrome"


@pytest.fixture(scope="session", autouse=True)
def live_server(app_port, tmp_path_factory):
    """Start a real uvicorn server for the test session."""
    import sys
    import os

    backend_dir = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "backend"
    )
    backend_dir = os.path.abspath(backend_dir)
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    # Use a temp database
    db_path = str(tmp_path_factory.mktemp("e2e") / "test.db")

    from app.database import init_db, get_db
    init_db(db_path)

    from app.main import app

    # Override get_db to use our test DB with cross-thread support
    def override_get_db():
        conn = sqlite3.connect(db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
        finally:
            conn.close()

    app.dependency_overrides[get_db] = override_get_db

    config = uvicorn.Config(
        app, host="127.0.0.1", port=app_port, log_level="warning"
    )
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    # Wait for server readiness — use bookmarks endpoint (health may have issues)
    url = f"http://127.0.0.1:{app_port}/api/v1/bookmarks"
    for _ in range(40):
        try:
            r = httpx.get(url, timeout=1)
            if r.status_code < 500:
                break
        except httpx.ConnectError:
            pass
        time.sleep(0.25)

    yield server

    server.should_exit = True
    app.dependency_overrides.clear()


@pytest.fixture()
def seed_data(base_url):
    """Seed a category and bookmark via REST API."""
    # Use unique names to avoid duplicate conflicts across tests
    suffix = uuid.uuid4().hex[:6]
    cat = httpx.post(
        f"{base_url}/api/v1/categories", json={"name": f"TestCat-{suffix}"}
    ).json()
    cat_id = cat["data"]["id"]

    bm = httpx.post(
        f"{base_url}/api/v1/bookmarks",
        json={
            "title": f"Test Bookmark {suffix}",
            "url": f"https://example-{suffix}.com",
            "category_id": cat_id,
            "tags": [f"e2e-{suffix}"],
        },
    ).json()

    return {"category_id": cat_id, "bookmark_id": bm["data"]["id"]}

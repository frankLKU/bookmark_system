import sqlite3
import pytest
from app.database import get_db, init_db, DB_PATH


class TestInitDb:
    def test_creates_bookmarks_table(self, tmp_path):
        db_path = tmp_path / "test.db"
        init_db(str(db_path))
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='bookmarks'")
        assert cursor.fetchone() is not None
        conn.close()

    def test_creates_categories_table(self, tmp_path):
        db_path = tmp_path / "test.db"
        init_db(str(db_path))
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'")
        assert cursor.fetchone() is not None
        conn.close()

    def test_creates_health_checks_table(self, tmp_path):
        db_path = tmp_path / "test.db"
        init_db(str(db_path))
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='health_checks'")
        assert cursor.fetchone() is not None
        conn.close()

    def test_idempotent_init(self, tmp_path):
        db_path = tmp_path / "test.db"
        init_db(str(db_path))
        init_db(str(db_path))  # should not raise

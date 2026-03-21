import pytest


class TestImportBookmarks:
    def test_import_returns_201(self, client):
        response = client.post("/api/v1/import", json={
            "content": "https://spark-f18.tsmc.com | Spark F18\nhttps://airflow-f12.tsmc.com | Airflow F12",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert "imported_count" in data["data"]
        assert "bookmarks" in data["data"]

    def test_import_with_category_id(self, client):
        response = client.post("/api/v1/import", json={
            "content": "https://spark-f18.tsmc.com | Spark F18",
            "category_id": 1,
        })
        assert response.status_code == 201

    def test_import_missing_content(self, client):
        response = client.post("/api/v1/import", json={})
        assert response.status_code == 422

    def test_import_empty_content(self, client):
        response = client.post("/api/v1/import", json={
            "content": "",
        })
        assert response.status_code == 201


class TestExportBookmarks:
    def test_export_returns_success(self, client):
        response = client.get("/api/v1/export")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "exported_at" in data["data"]
        assert "total" in data["data"]
        assert "categories" in data["data"]

    def test_export_with_category_filter(self, client):
        response = client.get("/api/v1/export?category_id=1")
        assert response.status_code == 200
        assert response.json()["success"] is True

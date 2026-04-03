import pytest


class TestImportOnetab:
    def test_parse_basic(self, client):
        resp = client.post("/api/v1/import/onetab", json={
            "content": "https://spark-f18.tsmc.com | Spark F18\nhttps://airflow-f12.tsmc.com | Airflow F12"
        })
        assert resp.status_code == 200
        preview = resp.json()["data"]["preview"]
        assert len(preview) == 2
        assert preview[0]["title"] == "Spark F18"
        assert "f18" in preview[0]["tags"]
        assert preview[0]["category"] == "Spark"
        assert preview[1]["title"] == "Airflow F12"
        assert "f12" in preview[1]["tags"]

    def test_auto_detect_factory_tag(self, client):
        resp = client.post("/api/v1/import/onetab", json={
            "content": "https://grafana-f14a.tsmc.com/dashboard | Grafana"
        })
        preview = resp.json()["data"]["preview"]
        assert "f14a" in preview[0]["tags"]

    def test_auto_detect_category(self, client):
        resp = client.post("/api/v1/import/onetab", json={
            "content": "https://grafana.tsmc.com | Grafana Dashboard"
        })
        preview = resp.json()["data"]["preview"]
        assert preview[0]["category"] == "Monitoring"

    def test_url_only_no_title(self, client):
        resp = client.post("/api/v1/import/onetab", json={
            "content": "https://spark-f18.tsmc.com"
        })
        preview = resp.json()["data"]["preview"]
        assert preview[0]["url"] == "https://spark-f18.tsmc.com"
        assert preview[0]["title"] != ""

    def test_empty_content(self, client):
        resp = client.post("/api/v1/import/onetab", json={"content": ""})
        assert resp.json()["data"]["preview"] == []


class TestImportConfirm:
    def test_confirm_creates_bookmarks(self, client):
        resp = client.post("/api/v1/import/confirm", json={
            "bookmarks": [
                {"title": "Spark F18", "url": "https://spark-f18.tsmc.com", "tags": ["f18"], "category": "Spark"}
            ]
        })
        assert resp.status_code == 201
        assert resp.json()["data"]["imported_count"] == 1

    def test_auto_creates_category(self, client):
        client.post("/api/v1/import/confirm", json={
            "bookmarks": [
                {"title": "Test", "url": "https://test.com", "tags": [], "category": "NewCategory"}
            ]
        })
        cats = client.get("/api/v1/categories").json()["data"]
        assert any(c["name"] == "NewCategory" for c in cats)

    def test_empty_list(self, client):
        resp = client.post("/api/v1/import/confirm", json={"bookmarks": []})
        assert resp.json()["data"]["imported_count"] == 0


class TestExport:
    def test_export_empty(self, client):
        resp = client.get("/api/v1/export")
        assert resp.status_code == 200
        assert resp.json()["data"]["total"] == 0

    def test_export_with_data(self, client, seed_bookmark):
        resp = client.get("/api/v1/export")
        data = resp.json()["data"]
        assert data["total"] == 1
        assert len(data["categories"]) >= 1


class TestImportJson:
    def test_roundtrip(self, client, seed_bookmark):
        export_resp = client.get("/api/v1/export")
        export_data = export_resp.json()["data"]

        # clear everything
        bookmarks = client.get("/api/v1/bookmarks").json()["data"]["items"]
        for b in bookmarks:
            client.delete(f"/api/v1/bookmarks/{b['id']}")

        # reimport
        resp = client.post("/api/v1/import/json", json=export_data)
        assert resp.status_code == 201
        assert resp.json()["data"]["imported_count"] == 1

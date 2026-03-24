from unittest.mock import patch, MagicMock
import httpx


class TestHealthCheck:
    def test_trigger_empty_db(self, client):
        resp = client.post("/api/v1/health/check")
        assert resp.status_code == 200
        assert resp.json()["data"]["checked"] == 0

    def test_trigger_with_bookmarks(self, client, seed_bookmark):
        with patch("app.routers.health.httpx.Client") as MockClient:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.head.return_value = httpx.Response(200)
            MockClient.return_value = mock_client
            resp = client.post("/api/v1/health/check")
            assert resp.json()["data"]["checked"] == 1

    def test_status_empty(self, client):
        resp = client.get("/api/v1/health/status")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_status_after_check(self, client, seed_bookmark):
        with patch("app.routers.health.httpx.Client") as MockClient:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.head.return_value = httpx.Response(200)
            MockClient.return_value = mock_client
            client.post("/api/v1/health/check")
        resp = client.get("/api/v1/health/status")
        statuses = resp.json()["data"]
        assert len(statuses) == 1
        assert statuses[0]["is_healthy"] is True

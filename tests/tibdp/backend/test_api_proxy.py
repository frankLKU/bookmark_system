from unittest.mock import patch, MagicMock
import httpx


class TestProxy:
    def test_missing_url_param(self, client):
        resp = client.get("/api/v1/proxy")
        assert resp.status_code == 422

    def test_successful_proxy(self, client):
        mock_response = httpx.Response(
            200,
            content=b"<html>Hello</html>",
            headers={"Content-Type": "text/html", "X-Frame-Options": "DENY"},
        )
        with patch("app.routers.proxy.httpx.Client") as MockClient:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_response
            MockClient.return_value = mock_client
            resp = client.get("/api/v1/proxy?url=https://example.com")
            assert resp.status_code == 200
            assert "X-Frame-Options" not in resp.headers

    def test_login_redirect_detected(self, client):
        mock_response = httpx.Response(
            302,
            headers={"Location": "https://sso.tsmc.com/login"},
        )
        with patch("app.routers.proxy.httpx.Client") as MockClient:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_response
            MockClient.return_value = mock_client
            resp = client.get("/api/v1/proxy?url=https://spark.tsmc.com")
            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is False
            assert "login" in body["message"].lower()

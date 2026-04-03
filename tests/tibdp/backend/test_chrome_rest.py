"""Tests for Chrome REST endpoints backed by ChromeBrowserManager."""
import pytest
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient


@pytest.fixture
def mock_browser_manager():
    """Mock ChromeBrowserManager to avoid launching real Chromium."""
    mgr = MagicMock()
    mgr.connected = True
    mgr.get_tabs.return_value = [
        {"id": "abc123", "url": "https://example.com", "title": "Test",
         "groupId": -1, "groupName": "F14", "active": True, "windowId": "win1"}
    ]
    return mgr


@pytest.fixture
def client_with_mock(mock_browser_manager):
    with patch("app.routers.chrome.browser_manager", mock_browser_manager):
        from app.main import app
        yield TestClient(app), mock_browser_manager


class TestChromeRestEndpoints:
    def test_get_tabs(self, client_with_mock):
        client, mgr = client_with_mock
        resp = client.get("/api/v1/chrome/tabs")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["connected"] is True
        assert len(data["data"]["tabs"]) == 1

    def test_get_tabs_not_connected(self, client_with_mock):
        client, mgr = client_with_mock
        mgr.connected = False
        mgr.get_tabs.return_value = []
        resp = client.get("/api/v1/chrome/tabs")
        data = resp.json()
        assert data["data"]["connected"] is False

    def test_open_tab_group(self, client_with_mock):
        client, mgr = client_with_mock
        resp = client.post("/api/v1/chrome/open-tab-group", json={
            "tag": "f14", "urls": ["https://example.com"]
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is True
        mgr.open_tab_group.assert_called_once()

    def test_open_single_tab(self, client_with_mock):
        client, mgr = client_with_mock
        resp = client.post("/api/v1/chrome/open-single-tab", json={
            "url": "https://example.com", "tag": "f14"
        })
        assert resp.status_code == 200
        mgr.open_single_tab.assert_called_once_with("https://example.com", "f14")

    def test_switch_tab(self, client_with_mock):
        client, mgr = client_with_mock
        mgr.switch_tab.return_value = True
        resp = client.post("/api/v1/chrome/switch-tab", json={"tabId": "abc123"})
        assert resp.status_code == 200
        mgr.switch_tab.assert_called_once_with("abc123")

    def test_close_tab(self, client_with_mock):
        client, mgr = client_with_mock
        mgr.close_tab.return_value = True
        resp = client.post("/api/v1/chrome/close-tab", json={"tabId": "abc123"})
        assert resp.status_code == 200
        mgr.close_tab.assert_called_once_with("abc123")

    def test_close_group(self, client_with_mock):
        client, mgr = client_with_mock
        mgr.close_group.return_value = True
        resp = client.post("/api/v1/chrome/close-group", json={"tag": "f14"})
        assert resp.status_code == 200
        mgr.close_group.assert_called_once_with("f14")

    def test_command_when_not_connected(self, client_with_mock):
        client, mgr = client_with_mock
        mgr.connected = False
        resp = client.post("/api/v1/chrome/open-tab-group", json={
            "tag": "f14", "urls": ["https://example.com"]
        })
        assert resp.json()["success"] is False
        assert "not running" in resp.json()["message"].lower()

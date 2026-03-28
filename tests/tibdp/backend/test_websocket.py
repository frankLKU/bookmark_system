import json
import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


@pytest.fixture(autouse=True)
def reset_chrome_manager():
    """Reset the chrome_manager singleton between tests to prevent state leaks."""
    from app.routers.websocket import chrome_manager
    chrome_manager._ws = None
    chrome_manager._tabs = []
    chrome_manager._on_focus_search = None
    yield
    chrome_manager._ws = None
    chrome_manager._tabs = []
    chrome_manager._on_focus_search = None


class TestWebSocketEndpoint:
    def test_connect_and_receive_message(self, client):
        """Extension connects and sends a message."""
        with client.websocket_connect("/ws/chrome") as ws:
            ws.send_json({"type": "connected"})
            # Connection should stay open (no exception)

    def test_tabs_updated_event(self, client):
        """Extension sends tabs_updated, server stores state."""
        from app.routers.websocket import chrome_manager

        with client.websocket_connect("/ws/chrome") as ws:
            ws.send_json({
                "type": "tabs_updated",
                "data": {"tabs": [{"id": 1, "url": "https://example.com", "title": "Example", "groupId": -1, "groupName": ""}]}
            })
        # After disconnect, verify tabs were stored
        assert len(chrome_manager.tabs) == 1
        assert chrome_manager.tabs[0]["id"] == 1

    def test_single_client_policy(self, client):
        """New connection replaces the old one — manager tracks latest only."""
        from app.routers.websocket import chrome_manager

        with client.websocket_connect("/ws/chrome") as ws1:
            ws1.send_json({"type": "connected"})
            assert chrome_manager.connected is True

            with client.websocket_connect("/ws/chrome") as ws2:
                ws2.send_json({"type": "connected"})
                # Manager should now track ws2, not ws1
                assert chrome_manager.connected is True
                # Send tabs_updated via ws2 to verify it's the active connection
                ws2.send_json({
                    "type": "tabs_updated",
                    "data": {"tabs": [{"id": 99, "url": "https://test.com", "title": "Test", "groupId": -1, "groupName": ""}]}
                })
        assert chrome_manager.tabs[0]["id"] == 99

    def test_focus_search_event(self, client):
        """Extension sends focus_search event, callback is invoked."""
        from app.routers.websocket import chrome_manager

        called = []
        chrome_manager.set_focus_callback(lambda: called.append(True))

        with client.websocket_connect("/ws/chrome") as ws:
            ws.send_json({"type": "focus_search"})

        assert len(called) == 1


class TestChromeRestEndpoints:
    def test_get_tabs_no_extension(self, client):
        """Get tabs when no extension is connected."""
        resp = client.get("/api/v1/chrome/tabs")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["connected"] is False
        assert data["data"]["tabs"] == []

    def test_get_tabs_with_extension(self, client):
        """Get tabs after extension sends tabs_updated."""
        from app.routers.websocket import chrome_manager

        with client.websocket_connect("/ws/chrome") as ws:
            ws.send_json({
                "type": "tabs_updated",
                "data": {"tabs": [{"id": 1, "url": "https://example.com", "title": "Example", "groupId": -1, "groupName": ""}]}
            })
            resp = client.get("/api/v1/chrome/tabs")
            assert resp.status_code == 200
            data = resp.json()
            assert data["data"]["connected"] is True
            assert len(data["data"]["tabs"]) == 1

    def test_open_tab_group_command(self, client):
        """Send open_tab_group command via REST."""
        with client.websocket_connect("/ws/chrome") as ws:
            resp = client.post("/api/v1/chrome/open-tab-group", json={
                "tag": "f14",
                "urls": ["https://example.com"]
            })
            assert resp.status_code == 200
            assert resp.json()["success"] is True
            msg = ws.receive_json()
            assert msg["type"] == "open_tab_group"
            assert msg["data"]["tag"] == "f14"
            assert msg["data"]["urls"] == ["https://example.com"]

    def test_switch_tab_command(self, client):
        """Send switch_tab command via REST."""
        with client.websocket_connect("/ws/chrome") as ws:
            resp = client.post("/api/v1/chrome/switch-tab", json={"tabId": 42})
            assert resp.status_code == 200
            msg = ws.receive_json()
            assert msg["type"] == "switch_tab"
            assert msg["data"]["tabId"] == 42

    def test_close_tab_command(self, client):
        """Send close_tab command via REST."""
        with client.websocket_connect("/ws/chrome") as ws:
            resp = client.post("/api/v1/chrome/close-tab", json={"tabId": 42})
            assert resp.status_code == 200
            msg = ws.receive_json()
            assert msg["type"] == "close_tab"

    def test_close_group_command(self, client):
        """Send close_group command via REST."""
        with client.websocket_connect("/ws/chrome") as ws:
            resp = client.post("/api/v1/chrome/close-group", json={"tag": "f14"})
            assert resp.status_code == 200
            msg = ws.receive_json()
            assert msg["type"] == "close_group"

    def test_command_when_not_connected(self, client):
        """Commands when no extension connected return success=false."""
        resp = client.post("/api/v1/chrome/open-tab-group", json={
            "tag": "f14",
            "urls": ["https://example.com"]
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is False
        assert "not connected" in resp.json()["message"].lower()

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

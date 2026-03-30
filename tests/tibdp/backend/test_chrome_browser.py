import pytest
from unittest.mock import AsyncMock, MagicMock, patch


class TestChromeBrowserManagerLifecycle:
    def test_initial_state_not_connected(self):
        from app.services.chrome_browser import ChromeBrowserManager
        mgr = ChromeBrowserManager(headless=True)
        assert mgr.connected is False

    def test_start_launches_browser(self):
        from app.services.chrome_browser import ChromeBrowserManager
        mgr = ChromeBrowserManager(headless=True)
        mgr.start()
        try:
            assert mgr.connected is True
        finally:
            mgr.stop()

    def test_stop_closes_browser(self):
        from app.services.chrome_browser import ChromeBrowserManager
        mgr = ChromeBrowserManager(headless=True)
        mgr.start()
        mgr.stop()
        assert mgr.connected is False

    def test_get_tabs_empty_when_started(self):
        from app.services.chrome_browser import ChromeBrowserManager
        mgr = ChromeBrowserManager(headless=True)
        mgr.start()
        try:
            tabs = mgr.get_tabs()
            assert tabs == []
        finally:
            mgr.stop()

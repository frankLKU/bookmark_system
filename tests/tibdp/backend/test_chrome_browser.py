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


class TestTabGroupOperations:
    @pytest.fixture(autouse=True)
    def manager(self):
        from app.services.chrome_browser import ChromeBrowserManager
        self.mgr = ChromeBrowserManager(headless=True)
        self.mgr.start()
        yield
        self.mgr.stop()

    def test_open_tab_group_creates_pages(self):
        self.mgr.open_tab_group("f14", ["https://example.com", "https://example.org"])
        tabs = self.mgr.get_tabs()
        assert len(tabs) == 2
        assert tabs[0]["groupName"] == "F14"
        assert tabs[1]["groupName"] == "F14"

    def test_open_tab_group_same_tag_focuses_existing(self):
        self.mgr.open_tab_group("f14", ["https://example.com"])
        self.mgr.open_tab_group("f14", ["https://example.com"])
        tabs = self.mgr.get_tabs()
        # Should not duplicate — still 1 tab
        assert len(tabs) == 1

    def test_open_tab_group_different_tags(self):
        self.mgr.open_tab_group("f14", ["https://example.com"])
        self.mgr.open_tab_group("f18", ["https://example.org"])
        tabs = self.mgr.get_tabs()
        assert len(tabs) == 2
        groups = {t["groupName"] for t in tabs}
        assert groups == {"F14", "F18"}

    def test_open_tab_group_with_focus_url(self):
        self.mgr.open_tab_group("f14", ["https://example.com", "https://example.org"], focus_url="https://example.org")
        tabs = self.mgr.get_tabs()
        assert len(tabs) == 2

    def test_open_single_tab_in_existing_group(self):
        self.mgr.open_tab_group("f14", ["https://example.com"])
        self.mgr.open_single_tab("https://example.org", "f14")
        tabs = self.mgr.get_tabs()
        assert len(tabs) == 2
        assert all(t["groupName"] == "F14" for t in tabs)

    def test_open_single_tab_no_tag(self):
        self.mgr.open_single_tab("https://example.com")
        tabs = self.mgr.get_tabs()
        assert len(tabs) == 1

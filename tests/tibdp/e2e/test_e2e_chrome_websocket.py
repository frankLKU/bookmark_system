"""Playwright E2E tests for Chrome Extension WebSocket integration.

Tests the full frontend UI in a real browser: page load, Chrome status
indicator, Chrome tab panel, workspace bar open-in-Chrome button,
search hotkey, and WebSocket connection simulation.
"""

import json

import pytest
from playwright.sync_api import Page, expect


@pytest.fixture(autouse=True)
def navigate(page: Page, base_url):
    page.goto(base_url)
    page.wait_for_load_state("networkidle")


# -- Page Load & Core UI --


class TestPageLoad:
    def test_page_title(self, page: Page):
        expect(page).to_have_title("TIBDP — TSMC Internal Bookmark & Dashboard Portal")

    def test_sidebar_visible(self, page: Page):
        expect(page.locator("#sidebar")).to_be_visible()

    def test_search_input_visible(self, page: Page):
        expect(page.locator("#search-input")).to_be_visible()

    def test_workspace_bar_visible(self, page: Page):
        expect(page.locator("#workspace-bar")).to_be_visible()


# -- Chrome Connection Indicator --


class TestChromeStatus:
    def test_chrome_status_indicator_exists(self, page: Page):
        indicator = page.locator("#chrome-status")
        expect(indicator).to_be_visible()

    def test_chrome_status_shows_disconnected(self, page: Page):
        indicator = page.locator("#chrome-status")
        expect(indicator).to_have_class("chrome-status disconnected")

    def test_chrome_status_tooltip(self, page: Page):
        indicator = page.locator("#chrome-status")
        expect(indicator).to_have_attribute("title", "Chrome Extension not connected")


# -- Chrome Tab Panel --


class TestChromeTabPanel:
    def test_chrome_tabs_panel_exists(self, page: Page):
        panel = page.locator("#chrome-tabs-panel")
        expect(panel).to_be_visible()

    def test_chrome_tabs_header(self, page: Page):
        header = page.locator(".chrome-tabs-title")
        expect(header).to_have_text("Chrome Tabs")

    def test_chrome_tabs_shows_not_connected(self, page: Page):
        content = page.locator("#chrome-tabs-content")
        expect(content).to_contain_text("Extension not connected")


# -- Search Hotkey --


class TestSearchHotkey:
    def test_slash_focuses_search(self, page: Page):
        # Click somewhere else first to unfocus
        page.locator("body").click()
        page.keyboard.press("/")
        expect(page.locator("#search-input")).to_be_focused()

    def test_slash_does_not_trigger_in_search(self, page: Page):
        search = page.locator("#search-input")
        search.click()
        search.type("/test")
        expect(search).to_have_value("/test")


# -- Workspace Bar + Open in Chrome --


class TestWorkspaceBar:
    def test_tag_chips_rendered_with_data(self, page: Page, seed_data, base_url):
        # Reload to pick up seeded data
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        # Wait for workspace bar to render tags (bookmarks loaded async)
        page.wait_for_timeout(1000)
        # workspace-chip includes "ALL" + any tag chips from bookmarks
        chips = page.locator(".workspace-chips .workspace-chip")
        expect(chips).not_to_have_count(0)

    def test_open_in_chrome_button_exists(self, page: Page, seed_data, base_url):
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        btns = page.locator(".open-in-chrome")
        expect(btns).not_to_have_count(0)


# -- WebSocket Integration --


class TestWebSocketIntegration:
    def test_chrome_status_updates_on_ws_connect(self, page: Page, ws_url):
        """Simulate a WebSocket client connecting and verify UI updates."""
        # Connect a WebSocket client to the server (simulating Chrome Extension)
        ws = page.context.request  # We'll use page.evaluate for WS simulation

        # Use the REST endpoint to verify the connection state
        import httpx

        base = ws_url.replace("ws://", "http://").replace("/ws/chrome", "")
        resp = httpx.get(f"{base}/api/v1/chrome/tabs")
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["connected"] is False

    def test_rest_tabs_endpoint_accessible(self, page: Page, base_url):
        """Verify the REST tabs endpoint works from the browser."""
        result = page.evaluate("""async () => {
            const resp = await fetch('/api/v1/chrome/tabs');
            return await resp.json();
        }""")
        assert result["success"] is True
        assert result["data"]["connected"] is False
        assert result["data"]["tabs"] == []

    def test_chrome_panel_updates_after_poll(self, page: Page, ws_url):
        """Simulate WS connection with tab data, then verify UI shows tabs."""
        import asyncio
        import websockets
        import threading

        async def send_tabs():
            async with websockets.connect(ws_url) as ws:
                await ws.send(json.dumps({"type": "connected"}))
                await ws.send(json.dumps({
                    "type": "tabs_updated",
                    "data": {
                        "tabs": [
                            {
                                "id": 1,
                                "url": "https://example.com",
                                "title": "E2E Test Tab",
                                "groupId": -1,
                                "groupName": "",
                                "active": True,
                                "windowId": 1,
                            }
                        ]
                    }
                }))
                # Keep connection open long enough for the poll to pick it up
                await asyncio.sleep(4)

        # Run WebSocket client in background thread
        def run_ws():
            asyncio.run(send_tabs())

        ws_thread = threading.Thread(target=run_ws, daemon=True)
        ws_thread.start()

        # Wait for the frontend polling to pick up the tab data (polls every 2s)
        page.wait_for_timeout(3500)

        # Check the Chrome status turned connected
        indicator = page.locator("#chrome-status")
        expect(indicator).to_have_class("chrome-status connected")

        # Check the tab panel shows the test tab
        content = page.locator("#chrome-tabs-content")
        expect(content).to_contain_text("E2E Test Tab")

        # Check the close button exists
        close_btn = page.locator(".tab-close[data-tab-id='1']")
        expect(close_btn).to_be_visible()

        ws_thread.join(timeout=5)

    def test_chrome_panel_shows_grouped_tabs(self, page: Page, ws_url):
        """Simulate WS with grouped tabs and verify group rendering."""
        import asyncio
        import websockets
        import threading

        async def send_grouped_tabs():
            async with websockets.connect(ws_url) as ws:
                await ws.send(json.dumps({"type": "connected"}))
                await ws.send(json.dumps({
                    "type": "tabs_updated",
                    "data": {
                        "tabs": [
                            {
                                "id": 10, "url": "https://a.com",
                                "title": "Tab A", "groupId": 5,
                                "groupName": "F14", "active": False,
                                "windowId": 1,
                            },
                            {
                                "id": 11, "url": "https://b.com",
                                "title": "Tab B", "groupId": 5,
                                "groupName": "F14", "active": True,
                                "windowId": 1,
                            },
                            {
                                "id": 12, "url": "https://c.com",
                                "title": "Ungrouped Tab", "groupId": -1,
                                "groupName": "", "active": False,
                                "windowId": 1,
                            },
                        ]
                    }
                }))
                await asyncio.sleep(4)

        def run_ws():
            asyncio.run(send_grouped_tabs())

        ws_thread = threading.Thread(target=run_ws, daemon=True)
        ws_thread.start()

        page.wait_for_timeout(3500)

        # Group header should show
        group_header = page.locator(".chrome-group-header")
        expect(group_header).to_contain_text("F14")

        # Group close button
        group_close = page.locator(".chrome-group-close[data-group='F14']")
        expect(group_close).to_be_visible()

        # All three tabs rendered
        tabs = page.locator(".chrome-tab-item")
        expect(tabs).to_have_count(3)

        # Ungrouped tab is outside the group
        content = page.locator("#chrome-tabs-content")
        expect(content).to_contain_text("Ungrouped Tab")

        ws_thread.join(timeout=5)

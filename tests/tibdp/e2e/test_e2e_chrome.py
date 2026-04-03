"""Playwright E2E tests for Chrome browser integration.

Tests the frontend UI: page load, Chrome status indicator, Chrome tab panel,
workspace bar, and search hotkey.
"""

import pytest
from playwright.sync_api import Page, expect


@pytest.fixture(autouse=True)
def navigate(page: Page, base_url):
    page.goto(base_url)
    page.wait_for_load_state("networkidle")


class TestPageLoad:
    def test_page_title(self, page: Page):
        expect(page).to_have_title("TIBDP — TSMC Internal Bookmark & Dashboard Portal")

    def test_sidebar_visible(self, page: Page):
        expect(page.locator("#sidebar")).to_be_visible()

    def test_search_input_visible(self, page: Page):
        expect(page.locator("#search-input")).to_be_visible()

    def test_workspace_bar_visible(self, page: Page):
        expect(page.locator("#workspace-bar")).to_be_visible()


class TestChromeStatus:
    def test_chrome_status_indicator_exists(self, page: Page):
        indicator = page.locator("#chrome-status")
        expect(indicator).to_be_visible()

    def test_chrome_status_shows_disconnected(self, page: Page):
        indicator = page.locator("#chrome-status")
        expect(indicator).to_have_class("chrome-status disconnected")

    def test_chrome_status_tooltip(self, page: Page):
        indicator = page.locator("#chrome-status")
        expect(indicator).to_have_attribute("title", "Chrome not connected")


class TestChromeTabPanel:
    def test_chrome_tabs_panel_exists(self, page: Page):
        panel = page.locator("#chrome-tabs-panel")
        expect(panel).to_be_visible()

    def test_chrome_tabs_header(self, page: Page):
        header = page.locator(".chrome-tabs-title")
        expect(header).to_have_text("Chrome Tabs")

    def test_chrome_tabs_shows_not_connected(self, page: Page):
        content = page.locator("#chrome-tabs-content")
        expect(content).to_contain_text("not connected")


class TestSearchHotkey:
    def test_slash_focuses_search(self, page: Page):
        page.locator("body").click()
        page.keyboard.press("/")
        expect(page.locator("#search-input")).to_be_focused()

    def test_slash_does_not_trigger_in_search(self, page: Page):
        search = page.locator("#search-input")
        search.click()
        search.type("/test")
        expect(search).to_have_value("/test")


class TestWorkspaceBar:
    def test_tag_chips_rendered_with_data(self, page: Page, seed_data, base_url):
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        chips = page.locator(".workspace-chips .workspace-chip")
        expect(chips).not_to_have_count(0)

    def test_open_in_chrome_button_exists(self, page: Page, seed_data, base_url):
        page.goto(base_url)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        btns = page.locator(".open-in-chrome")
        expect(btns).not_to_have_count(0)


class TestRestEndpoints:
    def test_rest_tabs_endpoint_accessible(self, page: Page):
        """Verify the REST tabs endpoint works from the browser."""
        result = page.evaluate("""async () => {
            const resp = await fetch('/api/v1/chrome/tabs');
            return await resp.json();
        }""")
        assert result["success"] is True
        assert isinstance(result["data"]["tabs"], list)

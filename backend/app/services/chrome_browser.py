"""ChromeBrowserManager — controls Chromium via Playwright.

Runs Playwright's async API in a dedicated thread with its own asyncio
event loop. All public methods are synchronous wrappers that dispatch
coroutines to that loop via run_coroutine_threadsafe.
"""

import asyncio
import logging
import os
import platform
import threading
import uuid

logger = logging.getLogger(__name__)


def _get_storage_dir():
    """Cross-platform storage directory for browser data."""
    if platform.system() == "Windows":
        base = os.environ.get("APPDATA", os.path.expanduser("~"))
        return os.path.join(base, "tibdp", "browser-data")
    return os.path.join(os.path.expanduser("~"), ".tibdp", "browser-data")


class ChromeBrowserManager:
    """Manages Playwright Chromium lifecycle and tab operations.

    Architecture:
    - One Browser instance (non-persistent, launched via playwright.chromium.launch)
    - One BrowserContext per tag (= one OS window per tag)
    - Pages within each context are individual tabs
    - Login state persisted via storage_state JSON export/import
    - All Playwright calls run on a dedicated asyncio event loop thread
    """

    def __init__(self, headless: bool = False):
        self._browser = None
        self._playwright = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._thread: threading.Thread | None = None
        self._headless = headless

        # tag(lowercase) → BrowserContext
        self._tag_contexts: dict[str, object] = {}
        # tag(lowercase) → context UUID (for windowId in responses)
        self._tag_window_ids: dict[str, str] = {}
        # page_id (UUID hex) → Page
        self._page_map: dict[str, object] = {}
        # page_id → tag (for reverse lookup)
        self._page_tags: dict[str, str] = {}
        # tag(lowercase) → page_id of last focused page
        self._active_pages: dict[str, str] = {}

        self._storage_dir = _get_storage_dir()
        self._storage_path = os.path.join(self._storage_dir, "storage-state.json")

        # Auto-restart state
        self._restart_failures = 0
        self._max_restart_failures = 3

    @property
    def connected(self) -> bool:
        return self._browser is not None and self._browser.is_connected()

    def start(self):
        """Start Playwright browser in a dedicated event loop thread."""
        if self._loop is not None:
            return  # Already running

        os.makedirs(self._storage_dir, exist_ok=True)

        ready = threading.Event()

        def _run_loop():
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
            self._loop.run_until_complete(self._start_browser())
            ready.set()
            self._loop.run_forever()

        self._thread = threading.Thread(target=_run_loop, daemon=True)
        self._thread.start()
        ready.wait(timeout=30)

    def stop(self):
        """Stop browser and event loop."""
        if self._loop is None:
            return
        try:
            future = asyncio.run_coroutine_threadsafe(
                self._stop_browser(), self._loop
            )
            future.result(timeout=10)
        except Exception:
            pass
        self._loop.call_soon_threadsafe(self._loop.stop)
        if self._thread:
            self._thread.join(timeout=5)
        self._loop = None
        self._thread = None

    def get_tabs(self) -> list[dict]:
        """Return all open tabs across all contexts."""
        if not self.connected:
            return []
        try:
            future = asyncio.run_coroutine_threadsafe(
                self._get_tabs(), self._loop
            )
            return future.result(timeout=5)
        except Exception:
            return []

    # --- Internal async methods (run on dedicated loop) ---

    async def _start_browser(self):
        from playwright.async_api import async_playwright
        self._playwright = await async_playwright().start()
        launch_args = ["--no-first-run", "--no-default-browser-check"]
        self._browser = await self._playwright.chromium.launch(
            headless=self._headless,
            args=launch_args,
        )
        self._browser.on("disconnected", lambda: self._on_browser_disconnected())
        self._restart_failures = 0
        logger.info("Chromium browser started")

    async def _stop_browser(self):
        # Save storage state from first available context
        await self._save_storage_state()
        for ctx in list(self._tag_contexts.values()):
            try:
                await ctx.close()
            except Exception:
                pass
        self._tag_contexts.clear()
        self._tag_window_ids.clear()
        self._page_map.clear()
        self._page_tags.clear()
        if self._browser:
            try:
                await self._browser.close()
            except Exception:
                pass
            self._browser = None
        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception:
                pass
            self._playwright = None

    async def _save_storage_state(self):
        """Export storage state from the first available context."""
        for ctx in self._tag_contexts.values():
            try:
                await ctx.storage_state(path=self._storage_path)
                return
            except Exception:
                pass

    async def _get_tabs(self) -> list[dict]:
        tabs = []
        for tag, ctx in list(self._tag_contexts.items()):
            window_id = self._tag_window_ids.get(tag, "")
            active_pid = self._active_pages.get(tag)
            for page_id, page in list(self._page_map.items()):
                if self._page_tags.get(page_id) != tag:
                    continue
                if page.is_closed():
                    continue
                try:
                    tabs.append({
                        "id": page_id,
                        "url": page.url or "",
                        "title": await page.title(),
                        "groupId": -1,
                        "groupName": tag.upper(),
                        "active": page_id == active_pid,
                        "windowId": window_id,
                    })
                except Exception:
                    pass
        return tabs

    def _on_browser_disconnected(self):
        """Handle unexpected browser disconnect — auto-restart with backoff."""
        logger.warning("Chromium disconnected unexpectedly")
        self._browser = None
        self._tag_contexts.clear()
        self._tag_window_ids.clear()
        self._page_map.clear()
        self._page_tags.clear()
        self._active_pages.clear()

        if self._restart_failures >= self._max_restart_failures:
            logger.error("Max restart attempts reached, not restarting")
            return

        self._restart_failures += 1
        if self._loop and self._loop.is_running():
            # Playwright disconnect event may fire from any thread —
            # use run_coroutine_threadsafe to be safe across threads
            asyncio.run_coroutine_threadsafe(self._start_browser(), self._loop)

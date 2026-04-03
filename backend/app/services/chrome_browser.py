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

    def open_tab_group(self, tag: str, urls: list[str], focus_url: str | None = None):
        """Open a group of URLs in a new window for the given tag."""
        if not self.connected or not urls:
            return
        future = asyncio.run_coroutine_threadsafe(
            self._open_tab_group(tag, urls, focus_url), self._loop
        )
        future.result(timeout=15)

    def open_single_tab(self, url: str, tag: str | None = None):
        """Open a single tab, optionally in an existing tag window."""
        if not self.connected or not url:
            return
        future = asyncio.run_coroutine_threadsafe(
            self._open_single_tab(url, tag), self._loop
        )
        future.result(timeout=10)

    def switch_tab(self, page_id: str) -> bool:
        """Bring a tab to front. Returns True if found, False otherwise."""
        if not self.connected:
            return False
        try:
            future = asyncio.run_coroutine_threadsafe(
                self._switch_tab(page_id), self._loop
            )
            return future.result(timeout=5)
        except Exception:
            return False

    def close_tab(self, page_id: str) -> bool:
        """Close a tab. Returns True if found, False otherwise."""
        if not self.connected:
            return False
        try:
            future = asyncio.run_coroutine_threadsafe(
                self._close_tab(page_id), self._loop
            )
            return future.result(timeout=5)
        except Exception:
            return False

    def close_group(self, tag: str) -> bool:
        """Close all tabs for a tag. Returns True if found, False otherwise."""
        if not self.connected:
            return False
        try:
            future = asyncio.run_coroutine_threadsafe(
                self._close_group(tag), self._loop
            )
            return future.result(timeout=10)
        except Exception:
            return False

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

    async def _get_or_create_context(self, tag: str):
        """Get existing context for tag, or create a new one."""
        tag_lower = tag.lower()
        ctx = self._tag_contexts.get(tag_lower)
        if ctx is not None:
            try:
                # Verify context is still alive by checking pages
                _ = ctx.pages
                return ctx
            except Exception:
                del self._tag_contexts[tag_lower]
                del self._tag_window_ids[tag_lower]

        # Create new context, loading storage state if available
        kwargs = {}
        if os.path.isfile(self._storage_path):
            kwargs["storage_state"] = self._storage_path

        try:
            ctx = await self._browser.new_context(**kwargs)
        except Exception:
            # Storage state may be corrupt — delete and retry without it
            if "storage_state" in kwargs:
                logger.warning("Storage state corrupt, deleting and retrying")
                try:
                    os.remove(self._storage_path)
                except OSError:
                    pass
                ctx = await self._browser.new_context()
            else:
                raise

        self._tag_contexts[tag_lower] = ctx
        self._tag_window_ids[tag_lower] = uuid.uuid4().hex[:8]

        # Listen for context close
        ctx.on("close", lambda: self._on_context_closed(tag_lower))
        return ctx

    async def _open_tab_group(self, tag: str, urls: list[str], focus_url: str | None = None):
        tag_lower = tag.lower()

        # If context already exists for this tag, just focus it
        if tag_lower in self._tag_contexts:
            ctx = self._tag_contexts[tag_lower]
            try:
                pages = ctx.pages
                if pages:
                    # Focus the matching URL or the first page
                    target = None
                    if focus_url:
                        target = next((p for p in pages if p.url == focus_url), None)
                    if target is None:
                        target = pages[0]
                    await target.bring_to_front()
                    return
            except Exception:
                # Context dead, remove and recreate
                del self._tag_contexts[tag_lower]
                if tag_lower in self._tag_window_ids:
                    del self._tag_window_ids[tag_lower]

        ctx = await self._get_or_create_context(tag)

        # Determine open order (focus_url first)
        first_url = focus_url if focus_url and focus_url in urls else urls[0]
        other_urls = [u for u in urls if u != first_url]

        # Open first URL in the default page or a new one
        if ctx.pages:
            page = ctx.pages[0]
            await page.goto(first_url, wait_until="commit")
        else:
            page = await ctx.new_page()
            await page.goto(first_url, wait_until="commit")

        page_id = uuid.uuid4().hex[:8]
        self._page_map[page_id] = page
        self._page_tags[page_id] = tag_lower
        page.on("close", lambda: self._on_page_closed(page_id))

        # Open remaining URLs
        for url in other_urls:
            p = await ctx.new_page()
            await p.goto(url, wait_until="commit")
            pid = uuid.uuid4().hex[:8]
            self._page_map[pid] = p
            self._page_tags[pid] = tag_lower
            p.on("close", lambda pid=pid: self._on_page_closed(pid))

        # Focus the first page
        await page.bring_to_front()
        self._active_pages[tag_lower] = page_id

    async def _open_single_tab(self, url: str, tag: str | None = None):
        if tag:
            tag_lower = tag.lower()
            if tag_lower in self._tag_contexts:
                ctx = self._tag_contexts[tag_lower]
                try:
                    page = await ctx.new_page()
                    await page.goto(url, wait_until="commit")
                    pid = uuid.uuid4().hex[:8]
                    self._page_map[pid] = page
                    self._page_tags[pid] = tag_lower
                    page.on("close", lambda: self._on_page_closed(pid))
                    await page.bring_to_front()
                    self._active_pages[tag_lower] = pid
                    return
                except Exception:
                    pass

        # No tag or tag context doesn't exist — create a new context
        effective_tag = tag or "_default"
        tag_lower = effective_tag.lower()
        ctx = await self._get_or_create_context(effective_tag)
        page = await ctx.new_page()
        await page.goto(url, wait_until="commit")
        pid = uuid.uuid4().hex[:8]
        self._page_map[pid] = page
        self._page_tags[pid] = tag_lower
        page.on("close", lambda: self._on_page_closed(pid))
        await page.bring_to_front()
        self._active_pages[tag_lower] = pid

    def _on_page_closed(self, page_id: str):
        """Clean up when a page is manually closed."""
        self._page_map.pop(page_id, None)
        self._page_tags.pop(page_id, None)

    def _on_context_closed(self, tag: str):
        """Clean up when a context (window) is manually closed."""
        # Remove all pages for this tag
        to_remove = [pid for pid, t in self._page_tags.items() if t == tag]
        for pid in to_remove:
            self._page_map.pop(pid, None)
            self._page_tags.pop(pid, None)
        self._tag_contexts.pop(tag, None)
        self._tag_window_ids.pop(tag, None)
        self._active_pages.pop(tag, None)

    async def _switch_tab(self, page_id: str) -> bool:
        page = self._page_map.get(page_id)
        if page is None or page.is_closed():
            return False
        await page.bring_to_front()
        tag = self._page_tags.get(page_id)
        if tag:
            self._active_pages[tag] = page_id
        return True

    async def _close_tab(self, page_id: str) -> bool:
        page = self._page_map.get(page_id)
        if page is None:
            return False
        try:
            await page.close()
        except Exception:
            pass
        # _on_page_closed callback handles cleanup
        return True

    async def _close_group(self, tag: str) -> bool:
        tag_lower = tag.lower()
        ctx = self._tag_contexts.get(tag_lower)
        if ctx is None:
            return False
        # Save storage state before closing
        await self._save_storage_state()
        try:
            await ctx.close()
        except Exception:
            pass
        # _on_context_closed callback handles cleanup
        return True

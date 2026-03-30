# Playwright Chrome Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Chrome Extension + WebSocket architecture with Playwright-controlled Chromium so the app works without installing a browser extension.

**Architecture:** Backend gains a `ChromeBrowserManager` service that controls Chromium via Playwright's async API in a dedicated thread. Each tag opens an independent BrowserContext (= separate window). REST API endpoints stay the same but call ChromeBrowserManager instead of forwarding WebSocket commands. Global hotkey via pynput replaces the content.js `/` shortcut.

**Tech Stack:** Python, FastAPI, Playwright (async API), pynput, pywebview

---

### Task 1: Update dependencies

**Files:**
- Modify: `requirements.txt`

- [ ] **Step 1: Update requirements.txt**

Remove `websockets` and add `playwright` and `pynput`:

```
fastapi>=0.110.0
uvicorn>=0.27.0
pydantic>=2.0.0
httpx>=0.27.0
pywebview>=5.0
playwright>=1.40.0
pynput>=1.7.0
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
cd /Users/frank/workspace/bookmark_system && pip install playwright pynput && playwright install chromium
```

- [ ] **Step 3: Commit**

```bash
git add requirements.txt
git commit -m "chore: replace websockets with playwright and pynput dependencies"
```

---

### Task 2: Create ChromeBrowserManager core (start/stop + event loop thread)

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/chrome_browser.py`
- Create: `tests/tibdp/backend/test_chrome_browser.py`

- [ ] **Step 1: Create `__init__.py` for services package**

Empty file at `backend/app/services/__init__.py`.

- [ ] **Step 2: Write failing tests for start/stop lifecycle**

```python
# tests/tibdp/backend/test_chrome_browser.py
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/backend/test_chrome_browser.py -v`
Expected: FAIL — module not found

- [ ] **Step 4: Implement ChromeBrowserManager core**

```python
# backend/app/services/chrome_browser.py
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/backend/test_chrome_browser.py -v`
Expected: PASS (4 tests)

Note: Tests use `headless=True` to avoid requiring a display. For headed debugging, change to `headless=False`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/__init__.py backend/app/services/chrome_browser.py tests/tibdp/backend/test_chrome_browser.py
git commit -m "feat: add ChromeBrowserManager core with start/stop lifecycle"
```

---

### Task 3: Add tab group operations to ChromeBrowserManager

**Files:**
- Modify: `backend/app/services/chrome_browser.py`
- Modify: `tests/tibdp/backend/test_chrome_browser.py`

- [ ] **Step 1: Write failing tests for open_tab_group**

Add to `tests/tibdp/backend/test_chrome_browser.py`:

```python
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
        self.mgr.open_tab_group("f14", ["https://a.com", "https://b.com"], focus_url="https://b.com")
        tabs = self.mgr.get_tabs()
        assert len(tabs) == 2

    def test_open_single_tab_in_existing_group(self):
        self.mgr.open_tab_group("f14", ["https://example.com"])
        self.mgr.open_single_tab("https://new.example.com", "f14")
        tabs = self.mgr.get_tabs()
        assert len(tabs) == 2
        assert all(t["groupName"] == "F14" for t in tabs)

    def test_open_single_tab_no_tag(self):
        self.mgr.open_single_tab("https://example.com")
        tabs = self.mgr.get_tabs()
        assert len(tabs) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/backend/test_chrome_browser.py::TestTabGroupOperations -v`
Expected: FAIL — methods not found

- [ ] **Step 3: Implement open_tab_group and open_single_tab**

Add these public sync methods and internal async methods to `ChromeBrowserManager`:

```python
    # --- Public sync wrappers ---

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

    # --- Internal async implementations ---

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
            await page.goto(first_url)
        else:
            page = await ctx.new_page()
            await page.goto(first_url)

        page_id = uuid.uuid4().hex[:8]
        self._page_map[page_id] = page
        self._page_tags[page_id] = tag_lower
        page.on("close", lambda: self._on_page_closed(page_id))

        # Open remaining URLs
        for url in other_urls:
            p = await ctx.new_page()
            await p.goto(url)
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
                    await page.goto(url)
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
        await page.goto(url)
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/backend/test_chrome_browser.py -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/chrome_browser.py tests/tibdp/backend/test_chrome_browser.py
git commit -m "feat: add tab group operations to ChromeBrowserManager"
```

---

### Task 4: Add switch_tab, close_tab, close_group to ChromeBrowserManager

**Files:**
- Modify: `backend/app/services/chrome_browser.py`
- Modify: `tests/tibdp/backend/test_chrome_browser.py`

- [ ] **Step 1: Write failing tests**

Add to `tests/tibdp/backend/test_chrome_browser.py`:

```python
class TestTabManagement:
    @pytest.fixture(autouse=True)
    def manager(self):
        from app.services.chrome_browser import ChromeBrowserManager
        self.mgr = ChromeBrowserManager(headless=True)
        self.mgr.start()
        yield
        self.mgr.stop()

    def test_switch_tab(self):
        self.mgr.open_tab_group("f14", ["https://example.com", "https://example.org"])
        tabs = self.mgr.get_tabs()
        assert len(tabs) == 2
        # Switch to second tab — should not raise
        self.mgr.switch_tab(tabs[1]["id"])

    def test_switch_tab_invalid_id(self):
        # Should not raise, just return False
        result = self.mgr.switch_tab("nonexistent")
        assert result is False

    def test_close_tab(self):
        self.mgr.open_tab_group("f14", ["https://example.com", "https://example.org"])
        tabs = self.mgr.get_tabs()
        assert len(tabs) == 2
        self.mgr.close_tab(tabs[0]["id"])
        tabs = self.mgr.get_tabs()
        assert len(tabs) == 1

    def test_close_tab_invalid_id(self):
        result = self.mgr.close_tab("nonexistent")
        assert result is False

    def test_close_group(self):
        self.mgr.open_tab_group("f14", ["https://example.com"])
        self.mgr.open_tab_group("f18", ["https://example.org"])
        assert len(self.mgr.get_tabs()) == 2
        self.mgr.close_group("f14")
        tabs = self.mgr.get_tabs()
        assert len(tabs) == 1
        assert tabs[0]["groupName"] == "F18"

    def test_close_group_nonexistent(self):
        result = self.mgr.close_group("nonexistent")
        assert result is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/backend/test_chrome_browser.py::TestTabManagement -v`
Expected: FAIL — methods not found

- [ ] **Step 3: Implement switch_tab, close_tab, close_group**

Add to `ChromeBrowserManager`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/backend/test_chrome_browser.py -v`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/chrome_browser.py tests/tibdp/backend/test_chrome_browser.py
git commit -m "feat: add switch_tab, close_tab, close_group to ChromeBrowserManager"
```

---

### Task 5: Add window positioning to ChromeBrowserManager

**Files:**
- Modify: `backend/app/services/chrome_browser.py`

- [ ] **Step 1: Add screen layout helper and apply to context creation**

Add a `_get_screen_layout` method and pass viewport/position when creating contexts. Playwright contexts support `viewport` and the browser's `--window-position` and `--window-size` args.

```python
def _get_screen_size(self):
    """Get primary screen resolution."""
    try:
        if platform.system() == "Windows":
            import ctypes
            user32 = ctypes.windll.user32
            return user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)
        elif platform.system() == "Darwin":
            # macOS — use AppKit if available
            try:
                from AppKit import NSScreen
                frame = NSScreen.mainScreen().frame()
                return int(frame.size.width), int(frame.size.height)
            except ImportError:
                pass
    except Exception:
        pass
    # Fallback
    return 3440, 1440

def _get_chrome_layout(self):
    """Return (left, top, width, height) for Chrome windows (right 90%)."""
    w, h = self._get_screen_size()
    menubar_width = int(w * 0.1)
    return menubar_width, 0, w - menubar_width, h
```

Update `_start_browser` to include window position args. Replace the existing `launch_args` line and `launch()` call:

Replace:
```python
        launch_args = ["--no-first-run", "--no-default-browser-check"]
```
With:
```python
        left, top, width, height = self._get_chrome_layout()
        launch_args = [
            "--no-first-run",
            "--no-default-browser-check",
            f"--window-position={left},{top}",
            f"--window-size={width},{height}",
        ]
```

Note: Keep `headless=self._headless` unchanged in the `launch()` call — do NOT replace the whole method.

Update `_get_or_create_context` — replace the `kwargs = {}` line and storage state loading section with viewport-aware version:

Replace this block in `_get_or_create_context`:
```python
        kwargs = {}
        if os.path.isfile(self._storage_path):
            kwargs["storage_state"] = self._storage_path
```
With:
```python
        _, _, width, height = self._get_chrome_layout()
        kwargs = {"viewport": {"width": width, "height": height}}
        if os.path.isfile(self._storage_path):
            kwargs["storage_state"] = self._storage_path
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/backend/test_chrome_browser.py -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/chrome_browser.py
git commit -m "feat: add screen-aware window positioning to ChromeBrowserManager"
```

---

### Task 6: Create chrome REST router (replacing websocket.py)

**Files:**
- Create: `backend/app/routers/chrome.py`
- Create: `tests/tibdp/backend/test_chrome_rest.py`

- [ ] **Step 1: Write failing tests for REST endpoints**

```python
# tests/tibdp/backend/test_chrome_rest.py
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/backend/test_chrome_rest.py -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement chrome.py router**

```python
# backend/app/routers/chrome.py
"""REST endpoints for Chrome browser control via Playwright.

Replaces the old websocket.py router. Same REST interface, but commands
go directly to ChromeBrowserManager instead of being forwarded via WebSocket.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.chrome_browser import ChromeBrowserManager

router = APIRouter()

# Lazy singleton — not started at import time. desktop_app.py calls
# browser_manager.start() after the server is ready. Tests can patch
# this module attribute without triggering a real Chromium launch.
browser_manager = ChromeBrowserManager()


# --- Request models ---

class OpenTabGroupRequest(BaseModel):
    tag: str
    urls: list[str]
    focusUrl: str | None = None


class OpenSingleTabRequest(BaseModel):
    url: str
    tag: str | None = None


class TabIdRequest(BaseModel):
    tabId: str


class TagRequest(BaseModel):
    tag: str


# --- Endpoints ---

@router.get("/chrome/tabs")
def get_chrome_tabs():
    return {
        "success": True,
        "data": {
            "connected": browser_manager.connected,
            "tabs": browser_manager.get_tabs(),
        },
        "message": "OK",
    }


@router.post("/chrome/open-tab-group")
def open_tab_group(req: OpenTabGroupRequest):
    if not browser_manager.connected:
        return {"success": False, "data": None, "message": "Browser not running"}
    browser_manager.open_tab_group(req.tag, req.urls, req.focusUrl)
    return {"success": True, "data": None, "message": "OK"}


@router.post("/chrome/open-single-tab")
def open_single_tab(req: OpenSingleTabRequest):
    if not browser_manager.connected:
        return {"success": False, "data": None, "message": "Browser not running"}
    browser_manager.open_single_tab(req.url, req.tag)
    return {"success": True, "data": None, "message": "OK"}


@router.post("/chrome/switch-tab")
def switch_tab(req: TabIdRequest):
    if not browser_manager.connected:
        return {"success": False, "data": None, "message": "Browser not running"}
    found = browser_manager.switch_tab(req.tabId)
    if not found:
        return {"success": False, "data": None, "message": "Tab not found"}
    return {"success": True, "data": None, "message": "OK"}


@router.post("/chrome/close-tab")
def close_tab(req: TabIdRequest):
    if not browser_manager.connected:
        return {"success": False, "data": None, "message": "Browser not running"}
    found = browser_manager.close_tab(req.tabId)
    if not found:
        return {"success": False, "data": None, "message": "Tab not found"}
    return {"success": True, "data": None, "message": "OK"}


@router.post("/chrome/close-group")
def close_group(req: TagRequest):
    if not browser_manager.connected:
        return {"success": False, "data": None, "message": "Browser not running"}
    found = browser_manager.close_group(req.tag)
    if not found:
        return {"success": False, "data": None, "message": "Group not found"}
    return {"success": True, "data": None, "message": "OK"}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/backend/test_chrome_rest.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/chrome.py tests/tibdp/backend/test_chrome_rest.py
git commit -m "feat: add chrome REST router backed by ChromeBrowserManager"
```

---

### Task 7: Update main.py — swap websocket router for chrome router

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Update main.py imports and router mounts**

Replace:
```python
from app.routers import bookmarks, categories, import_export, health, websocket
```
With:
```python
from app.routers import bookmarks, categories, import_export, health, chrome
```

Replace:
```python
app.include_router(websocket.ws_router, tags=["websocket"])
app.include_router(websocket.rest_router, prefix="/api/v1", tags=["chrome"])
```
With:
```python
app.include_router(chrome.router, prefix="/api/v1", tags=["chrome"])
```

- [ ] **Step 2: Run existing tests to verify nothing breaks**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/backend/test_api_bookmarks.py tests/tibdp/backend/test_api_categories.py tests/tibdp/backend/test_chrome_rest.py -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "refactor: replace websocket router with chrome router in main.py"
```

---

### Task 8: Update frontend chrome-tabs.js for string tab IDs and groupName-based grouping

**Files:**
- Modify: `frontend/js/components/chrome-tabs.js`

- [ ] **Step 1: Fix parseInt calls for tab IDs**

The current code uses `parseInt(el.dataset.tabId, 10)` which would turn UUID strings into `NaN`. Change to use raw string values.

Replace:
```javascript
                const tabId = parseInt(el.dataset.tabId, 10);
                Store.switchChromeTab(tabId);
```
With:
```javascript
                const tabId = el.dataset.tabId;
                Store.switchChromeTab(tabId);
```

Replace:
```javascript
                const tabId = parseInt(btn.dataset.tabId, 10);
                Store.closeChromeTab(tabId);
```
With:
```javascript
                const tabId = btn.dataset.tabId;
                Store.closeChromeTab(tabId);
```

- [ ] **Step 2: Fix group detection logic**

Since Playwright always returns `groupId: -1`, change grouping condition to check only `groupName`.

Replace:
```javascript
            if (tab.groupId !== -1 && tab.groupName) {
```
With:
```javascript
            if (tab.groupName) {
```

- [ ] **Step 3: Update connection status tooltip text**

Replace:
```javascript
        indicator.title = connected ? 'Chrome Extension connected' : 'Chrome Extension not connected';
```
With:
```javascript
        indicator.title = connected ? 'Chrome connected' : 'Chrome not connected';
```

Replace:
```javascript
            container.innerHTML = '<div class="chrome-tab-item" style="color:var(--color-text-tertiary);cursor:default;">Extension not connected</div>';
```
With:
```javascript
            container.innerHTML = '<div class="chrome-tab-item" style="color:var(--color-text-tertiary);cursor:default;">Browser not connected</div>';
```

- [ ] **Step 4: Commit**

```bash
git add frontend/js/components/chrome-tabs.js
git commit -m "fix: update chrome-tabs.js for string tab IDs and groupName-based grouping"
```

---

### Task 9: Update desktop_app.py — Playwright startup + global hotkey

**Files:**
- Modify: `desktop_app.py`

- [ ] **Step 1: Update desktop_app.py**

Major changes:
1. Remove WebSocket focus callback setup
2. Add ChromeBrowserManager startup (after server ready, before pywebview)
3. Add pynput global hotkey `Ctrl+Shift+F`
4. Update shutdown to stop ChromeBrowserManager
5. Use ctypes for Windows screen detection

```python
"""TIBDP Desktop App — pywebview entry point.

Starts FastAPI in a background thread, then opens a pywebview main window
pointing at the local dashboard. Bookmarks open via Playwright-controlled
Chromium. Global hotkey Ctrl+Shift+F focuses the search box.
"""

import os
import platform
import socket
import sys
import threading
import time

import httpx
import uvicorn
import webview

# ---------------------------------------------------------------------------
# Server thread
# ---------------------------------------------------------------------------

HOST = "127.0.0.1"
PORT = 8765


def _check_port_available():
    """Fail fast if another instance is already running."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex((HOST, PORT)) == 0:
            webview.create_window(
                "Error",
                html="<h2>Another instance is already running on port 8765</h2>",
                width=400, height=200,
            )
            webview.start()
            sys.exit(1)


def _start_server():
    """Run FastAPI/uvicorn in a daemon thread."""
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    from app.main import app  # noqa: E402

    config = uvicorn.Config(app, host=HOST, port=PORT, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    return server


def _wait_for_server(max_retries=20, interval=0.5):
    """Poll until the server is ready."""
    url = f"http://{HOST}:{PORT}/api/v1/bookmarks"
    for _ in range(max_retries):
        try:
            resp = httpx.get(url, timeout=2)
            if resp.status_code < 500:
                return True
        except httpx.ConnectError:
            pass
        time.sleep(interval)
    return False


# ---------------------------------------------------------------------------
# ChromeBrowserManager startup
# ---------------------------------------------------------------------------

def _start_browser_manager():
    """Start the Playwright-based browser manager."""
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    from app.routers.chrome import browser_manager
    browser_manager.start()
    return browser_manager


# ---------------------------------------------------------------------------
# Global hotkey
# ---------------------------------------------------------------------------

def _setup_global_hotkey(window):
    """Register Ctrl+Shift+F as global hotkey to focus search box."""
    try:
        from pynput.keyboard import GlobalHotKeys

        def on_activate():
            threading.Thread(
                target=_bring_to_front,
                args=(window,),
                daemon=True,
            ).start()

        hotkeys = GlobalHotKeys({"<ctrl>+<shift>+f": on_activate})
        hotkeys.daemon = True
        hotkeys.start()
        return hotkeys
    except ImportError:
        pass  # pynput not available
    return None


# ---------------------------------------------------------------------------
# Focus handling (thread-safe)
# ---------------------------------------------------------------------------

def _bring_to_front(window):
    """Bring pywebview window to front and focus search box."""
    try:
        window.show()
        if platform.system() == "Darwin":
            try:
                from AppKit import NSApp  # pyobjc
                NSApp.activateIgnoringOtherApps_(True)
            except ImportError:
                pass
        elif platform.system() == "Windows":
            try:
                import ctypes
                ctypes.windll.user32.SetForegroundWindow(
                    ctypes.windll.user32.GetForegroundWindow()
                )
            except Exception:
                pass
        window.evaluate_js("document.querySelector('#search-input')?.focus()")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Screen detection
# ---------------------------------------------------------------------------

def _get_screen_size():
    """Get primary screen dimensions."""
    try:
        screen = webview.screens[0]
        return screen.width, screen.height
    except Exception:
        pass
    try:
        if platform.system() == "Windows":
            import ctypes
            user32 = ctypes.windll.user32
            return user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)
    except Exception:
        pass
    return 3440, 1440


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    _check_port_available()
    server = _start_server()

    if not _wait_for_server():
        webview.create_window(
            "Error",
            html="<h2>Server failed to start within 10 seconds</h2>",
            width=400, height=200,
        )
        webview.start()
        sys.exit(1)

    # Start Playwright browser (after server ready, before pywebview)
    browser_mgr = _start_browser_manager()

    # Screen layout
    screen_width, screen_height = _get_screen_size()
    menubar_width = int(screen_width * 0.1)

    main_window = webview.create_window(
        "TIBDP — Bookmark Dashboard",
        f"http://{HOST}:{PORT}",
        x=0,
        y=0,
        width=menubar_width,
        height=screen_height,
    )

    hotkey_listener = None

    def on_closed():
        browser_mgr.stop()
        server.should_exit = True

    def on_shown():
        nonlocal hotkey_listener
        hotkey_listener = _setup_global_hotkey(main_window)

    main_window.events.closed += on_closed
    main_window.events.shown += on_shown
    webview.start()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add desktop_app.py
git commit -m "feat: update desktop_app.py with Playwright startup and global hotkey"
```

---

### Task 10: Remove old Chrome Extension and WebSocket files

**Files:**
- Delete: `chrome-extension/manifest.json`
- Delete: `chrome-extension/background.js`
- Delete: `chrome-extension/content.js`
- Delete: `backend/app/routers/websocket.py`
- Delete: `tests/tibdp/backend/test_websocket.py`

- [ ] **Step 1: Remove files**

```bash
rm -rf chrome-extension/
rm backend/app/routers/websocket.py
rm tests/tibdp/backend/test_websocket.py
```

- [ ] **Step 2: Run all backend tests to ensure nothing references deleted files**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/backend/ -v`
Expected: PASS (websocket tests gone, chrome tests pass)

- [ ] **Step 3: Commit**

```bash
git rm -r chrome-extension/
git rm backend/app/routers/websocket.py
git rm tests/tibdp/backend/test_websocket.py
git commit -m "refactor: remove Chrome Extension and WebSocket files (replaced by Playwright)"
```

---

### Task 11: Update E2E tests

**Files:**
- Modify: `tests/tibdp/e2e/conftest.py`
- Modify: `tests/tibdp/e2e/test_e2e_chrome_websocket.py` → rename to `test_e2e_chrome.py`

- [ ] **Step 1: Update E2E conftest — remove ws_url fixture**

In `tests/tibdp/e2e/conftest.py`, remove the `ws_url` fixture (lines 34-36):

```python
# DELETE this fixture:
@pytest.fixture(scope="session")
def ws_url(app_port):
    return f"ws://127.0.0.1:{app_port}/ws/chrome"
```

- [ ] **Step 2: Rename and rewrite E2E test file**

Rename `test_e2e_chrome_websocket.py` to `test_e2e_chrome.py`. Remove WebSocket-dependent tests (`TestWebSocketIntegration`). Keep and update the UI tests:

```python
# tests/tibdp/e2e/test_e2e_chrome.py
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
```

- [ ] **Step 3: Run E2E tests**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/e2e/ -v`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd /Users/frank/workspace/bookmark_system
git rm tests/tibdp/e2e/test_e2e_chrome_websocket.py
git add tests/tibdp/e2e/test_e2e_chrome.py tests/tibdp/e2e/conftest.py
git commit -m "test: update E2E tests — remove WebSocket tests, add REST endpoint test"
```

---

### Task 12: Storage state periodic export

**Files:**
- Modify: `backend/app/services/chrome_browser.py`

- [ ] **Step 1: Add periodic storage state export**

Add a background task in the event loop that saves storage state every 5 minutes:

```python
    async def _start_browser(self):
        # ... existing code ...
        # Start periodic storage state export
        asyncio.ensure_future(self._periodic_save_storage())

    async def _periodic_save_storage(self):
        """Save storage state every 5 minutes."""
        try:
            while True:
                await asyncio.sleep(300)  # 5 minutes
                if self._browser and self._browser.is_connected():
                    await self._save_storage_state()
                    logger.debug("Storage state saved periodically")
        except asyncio.CancelledError:
            pass
```

- [ ] **Step 2: Run all tests**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/backend/ -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/chrome_browser.py
git commit -m "feat: add periodic storage state export (every 5 min)"
```

---

### Task 13: Run full test suite and verify

**Files:** None (verification only)

- [ ] **Step 1: Run all backend tests**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/backend/ -v`
Expected: PASS (all chrome_browser, chrome_rest, bookmarks, categories, etc.)

- [ ] **Step 2: Run all E2E tests**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/tibdp/e2e/ -v`
Expected: PASS

- [ ] **Step 3: Run full suite**

Run: `cd /Users/frank/workspace/bookmark_system/backend && python -m pytest tests/ -v`
Expected: ALL PASS

- [ ] **Step 4: Push to remote**

```bash
cd /Users/frank/workspace/bookmark_system && git push
```

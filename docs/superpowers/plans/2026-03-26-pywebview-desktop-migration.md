# pywebview Desktop App Migration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace iframe-based bookmark viewing with pywebview desktop app — main dashboard in pywebview window, each bookmark opens in a native child window.

**Architecture:** FastAPI runs in a daemon background thread on `localhost:8765`. pywebview creates the main window loading the dashboard. A `BookmarkBridge` JS API class manages child windows for bookmarks. Frontend JS calls bridge methods via `window.pywebview.api`.

**Tech Stack:** Python, pywebview (>=5.0), FastAPI, uvicorn, vanilla HTML/CSS/JS

---

## File Structure

### New Files
- `desktop_app.py` — pywebview entry point with BookmarkBridge, starts FastAPI + main window
- `frontend/js/components/smart-window.js` — replaces smart-iframe.js, calls bridge to open/close/focus child windows

### Modified Files
- `frontend/index.html:119-120` — replace smart-iframe.js + split-view.js script tags with smart-window.js
- `frontend/js/app.js:26-27` — replace SmartIframe/SplitView init with SmartWindow init
- `frontend/js/components/tab-bar.js:34-47` — add SmartWindow.focusBookmark on tab click, SmartWindow.closeBookmark on close
- `frontend/js/components/sidebar.js` — add SmartWindow.openBookmark call after Store.openTab (spec deviation: necessary for child windows to actually open)
- `frontend/css/components.css:551-723` — remove iframe/split-view styles, add window-status-card styles
- `frontend/js/store.js:6,156,181-207` — remove combined view code (isCombined, openCombinedTab, exitCombinedView)
- `requirements.txt` (root) — add `pywebview>=5.0`
- `backend/app/main.py:9,31` — remove proxy router import and include

### Removed Files
- `frontend/js/components/smart-iframe.js` — replaced by smart-window.js
- `frontend/js/components/split-view.js` — no longer needed (pywebview child windows replace split view)
- `backend/app/routers/proxy.py` — no longer needed (child windows load URLs directly)
- `tests/tibdp/backend/test_api_proxy.py` — tests for removed proxy

---

### Task 1: Create `desktop_app.py` Entry Point

**Files:**
- Create: `desktop_app.py`

- [ ] **Step 1: Create desktop_app.py with full implementation**

```python
"""TIBDP Desktop App — pywebview entry point.

Starts FastAPI in a background thread, then opens a pywebview main window
pointing at the local dashboard. BookmarkBridge exposes JS API for child windows.
"""

import json
import os
import socket
import sys
import threading
import time

import httpx
import uvicorn
import webview

# ---------------------------------------------------------------------------
# BookmarkBridge — JS API exposed as window.pywebview.api
# ---------------------------------------------------------------------------

class BookmarkBridge:
    def __init__(self):
        self._windows = {}  # tab_id -> webview.Window
        self._main_window = None

    def set_main_window(self, window):
        self._main_window = window

    def open_bookmark(self, tab_id, url, title):
        if tab_id in self._windows:
            self._focus_window(tab_id)
            return
        window = webview.create_window(title, url, width=1200, height=800)
        window.events.closed += lambda: self._on_child_closed(tab_id)
        self._windows[tab_id] = window

    def close_bookmark(self, tab_id):
        if tab_id in self._windows:
            window = self._windows.pop(tab_id)
            window.destroy()

    def focus_bookmark(self, tab_id):
        self._focus_window(tab_id)

    def close_all(self):
        for w in list(self._windows.values()):
            w.destroy()
        self._windows.clear()

    def _focus_window(self, tab_id):
        if tab_id in self._windows:
            w = self._windows[tab_id]
            w.show()
            w.minimize()
            w.restore()

    def _on_child_closed(self, tab_id):
        self._windows.pop(tab_id, None)
        try:
            if self._main_window:
                self._main_window.evaluate_js(
                    f"if(typeof Store!=='undefined')Store.closeTab({json.dumps(tab_id)})"
                )
        except Exception:
            pass  # Main window already destroyed


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
    # Ensure backend package is importable
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

    bridge = BookmarkBridge()
    main_window = webview.create_window(
        "TIBDP — Bookmark Dashboard",
        f"http://{HOST}:{PORT}",
        width=1400,
        height=900,
        js_api=bridge,
    )
    bridge.set_main_window(main_window)

    def on_closed():
        bridge.close_all()
        server.should_exit = True

    main_window.events.closed += on_closed
    webview.start()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify it parses without errors**

Run: `cd /Users/frank/workspace/bookmark_system && python -c "import ast; ast.parse(open('desktop_app.py').read()); print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add desktop_app.py
git commit -m "feat: add desktop_app.py pywebview entry point with BookmarkBridge"
```

---

### Task 2: Create `smart-window.js` (Replaces `smart-iframe.js`)

**Files:**
- Create: `frontend/js/components/smart-window.js`

- [ ] **Step 1: Create smart-window.js**

```javascript
const SmartWindow = (() => {
    let _bridgeReady = false;

    function init() {
        // pywebview bridge becomes available after this event
        window.addEventListener('pywebviewready', () => {
            _bridgeReady = true;
        });
        // Also check if already ready (race condition guard)
        if (window.pywebview && window.pywebview.api) {
            _bridgeReady = true;
        }

        Store.on('activeTab:changed', render);
        Store.on('tabs:changed', render);
        render();
    }

    function openBookmark(tabId, url, title) {
        if (_bridgeReady && window.pywebview) {
            window.pywebview.api.open_bookmark(tabId, url, title);
        } else {
            // Fallback for browser-based development
            window.open(url, '_blank');
        }
    }

    function focusBookmark(tabId) {
        if (_bridgeReady && window.pywebview) {
            window.pywebview.api.focus_bookmark(tabId);
        }
    }

    function closeBookmark(tabId) {
        if (_bridgeReady && window.pywebview) {
            window.pywebview.api.close_bookmark(tabId);
        }
    }

    function render() {
        const contentArea = document.getElementById('content-area');
        const emptyState = document.getElementById('empty-state');
        if (!contentArea) return;

        contentArea.querySelectorAll('.window-status-card').forEach(el => el.remove());

        const { tabs, activeTabId } = Store.getState();
        const activeTab = tabs.find(t => t.id === activeTabId);

        if (!activeTab) {
            if (emptyState) emptyState.classList.remove('hidden');
            return;
        }

        if (emptyState) emptyState.classList.add('hidden');

        // Show status card instead of iframe
        const card = document.createElement('div');
        card.className = 'window-status-card';
        card.innerHTML = `
            <h3>${escapeHtml(activeTab.title)}</h3>
            <p>Opened in separate window</p>
            <button class="btn btn-primary" data-action="focus">Focus Window</button>
            <button class="btn btn-ghost" data-action="close">Close Window</button>
        `;
        card.querySelector('[data-action="focus"]').addEventListener('click', () => {
            focusBookmark(activeTab.id);
        });
        card.querySelector('[data-action="close"]').addEventListener('click', () => {
            Store.closeTab(activeTab.id);
            closeBookmark(activeTab.id);
        });
        contentArea.appendChild(card);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init, openBookmark, focusBookmark, closeBookmark };
})();
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/components/smart-window.js
git commit -m "feat: add smart-window.js for pywebview bridge integration"
```

---

### Task 3: Update `index.html` — Replace Script Tags

**Files:**
- Modify: `frontend/index.html:119-120`

- [ ] **Step 1: Replace smart-iframe.js and split-view.js script tags with smart-window.js**

In `frontend/index.html`, replace lines 119-120:

```html
  <script src="js/components/smart-iframe.js" defer></script>
  <script src="js/components/split-view.js" defer></script>
```

with:

```html
  <script src="js/components/smart-window.js" defer></script>
```

- [ ] **Step 2: Update content-area comment**

In `frontend/index.html`, replace line 86:

```html
        <!-- Iframes rendered by JS -->
```

with:

```html
        <!-- Content rendered by SmartWindow -->
```

- [ ] **Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "feat: replace smart-iframe/split-view script tags with smart-window"
```

---

### Task 4: Update `app.js` — Replace SmartIframe/SplitView Init

**Files:**
- Modify: `frontend/js/app.js:26-27`

- [ ] **Step 1: Replace SmartIframe and SplitView init with SmartWindow**

In `frontend/js/app.js`, replace lines 26-27:

```javascript
    if (typeof SmartIframe !== 'undefined' && SmartIframe.init) SmartIframe.init();
    if (typeof SplitView !== 'undefined' && SplitView.init) SplitView.init();
```

with:

```javascript
    if (typeof SmartWindow !== 'undefined' && SmartWindow.init) SmartWindow.init();
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/app.js
git commit -m "feat: replace SmartIframe/SplitView init with SmartWindow in app.js"
```

---

### Task 5: Update `tab-bar.js` — Add SmartWindow Calls

**Files:**
- Modify: `frontend/js/components/tab-bar.js:34-47`

- [ ] **Step 1: Add SmartWindow.focusBookmark on tab click**

In `frontend/js/components/tab-bar.js`, replace lines 33-39 (the tab click handler):

```javascript
        // Click to switch tab
        tabList.querySelectorAll('.tab').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.tab-close')) return;
                Store.setActiveTab(el.dataset.tabId);
            });
        });
```

with:

```javascript
        // Click to switch tab — also focus the child window
        tabList.querySelectorAll('.tab').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.tab-close')) return;
                Store.setActiveTab(el.dataset.tabId);
                if (typeof SmartWindow !== 'undefined') {
                    SmartWindow.focusBookmark(el.dataset.tabId);
                }
            });
        });
```

- [ ] **Step 2: Add SmartWindow.closeBookmark on tab close**

Replace lines 41-47 (the close button handler):

```javascript
        // Close button
        tabList.querySelectorAll('.tab-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                Store.closeTab(btn.dataset.tabId);
            });
        });
```

with:

```javascript
        // Close button — also close the child window
        tabList.querySelectorAll('.tab-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof SmartWindow !== 'undefined') {
                    SmartWindow.closeBookmark(btn.dataset.tabId);
                }
                Store.closeTab(btn.dataset.tabId);
            });
        });
```

- [ ] **Step 3: Commit**

```bash
git add frontend/js/components/tab-bar.js
git commit -m "feat: integrate SmartWindow focus/close into tab-bar click handlers"
```

---

### Task 6: Update `sidebar.js` — Open Bookmarks via SmartWindow

**Files:**
- Modify: `frontend/js/components/sidebar.js` — bookmark click handler

- [ ] **Step 1: Find the bookmark click handler in sidebar.js and add SmartWindow.openBookmark call**

When a bookmark item is clicked, `Store.openTab(bookmark)` is called. After that call, also call `SmartWindow.openBookmark(tab.id, bookmark.url, bookmark.title)`.

The tab ID is generated inside `Store.openTab()` as `'tab-' + Date.now()`. After calling `Store.openTab(bookmark)`, the active tab ID is available from `Store.getState().activeTabId`.

Add after the `Store.openTab(bookmark)` call:

```javascript
// Open in pywebview child window
const { activeTabId } = Store.getState();
if (typeof SmartWindow !== 'undefined') {
    SmartWindow.openBookmark(activeTabId, bookmark.url, bookmark.title);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/js/components/sidebar.js
git commit -m "feat: open bookmarks via SmartWindow child window from sidebar"
```

---

### Task 7: Update CSS — Remove Iframe/Split Styles, Add Window Status Card

**Files:**
- Modify: `frontend/css/components.css:551-723`

- [ ] **Step 1: Remove iframe-related error card styles (lines 551-583)**

Remove the `/* ---------- Error Card (Iframe Fallback) ---------- */` section (`.error-card`, `.error-card-icon`, `.error-card-title`, `.error-card-message`).

- [ ] **Step 2: Remove split view styles (lines 653-723)**

Remove the `/* ---------- Split View ---------- */` section (`.split-view`, `.split-pane`, `.split-divider`, `.split-pane-header`, `.split-pane-title`, `.split-pane-actions`, `.split-pane-content`).

- [ ] **Step 3: Remove combined view banner styles (lines 724-740)**

Remove the `/* ---------- Combined View Banner ---------- */` section (`.combined-banner`, `.combined-banner-text`).

- [ ] **Step 4: Add window-status-card styles**

Add at the end of components.css (before the loading spinner section or after empty state):

```css
/* ---------- Window Status Card ---------- */
.window-status-card {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-width: 400px;
  width: 90%;
  padding: var(--space-8);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background-color: var(--bg-primary);
  box-shadow: var(--shadow-lg);
  text-align: center;
}

.window-status-card h3 {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 var(--space-2) 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-status-card p {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin: 0 0 var(--space-6) 0;
}

.window-status-card .btn {
  margin: 0 var(--space-1);
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/css/components.css
git commit -m "feat: replace iframe/split-view CSS with window-status-card styles"
```

---

### Task 8: Remove Proxy Router from Backend

**Files:**
- Modify: `backend/app/main.py:9,31`
- Delete: `backend/app/routers/proxy.py`
- Delete: `tests/tibdp/backend/test_api_proxy.py`

- [ ] **Step 1: Remove proxy import from main.py line 9**

In `backend/app/main.py`, replace line 9:

```python
from app.routers import bookmarks, categories, import_export, health, proxy
```

with:

```python
from app.routers import bookmarks, categories, import_export, health
```

- [ ] **Step 2: Remove proxy router include from main.py line 31**

Remove:

```python
app.include_router(proxy.router, prefix="/api/v1", tags=["proxy"])
```

- [ ] **Step 3: Run backend tests to confirm nothing breaks (proxy tests will fail on import, that's expected)**

Run: `cd /Users/frank/workspace/bookmark_system/backend && PYTHONPATH=. ./venv/bin/pytest ../tests/ -v --tb=short --ignore=../tests/tibdp/backend/test_api_proxy.py`
Expected: All non-proxy tests pass (61 tests)

- [ ] **Step 4: Commit (use git rm to delete + stage in one step)**

```bash
cd /Users/frank/workspace/bookmark_system
git add backend/app/main.py
git rm backend/app/routers/proxy.py tests/tibdp/backend/test_api_proxy.py
git commit -m "feat: remove proxy router — no longer needed with pywebview child windows"
```

---

### Task 9: Delete Old Frontend Files

**Files:**
- Delete: `frontend/js/components/smart-iframe.js`
- Delete: `frontend/js/components/split-view.js`

- [ ] **Step 1: Delete and commit (use git rm to delete + stage in one step)**

```bash
cd /Users/frank/workspace/bookmark_system
git rm frontend/js/components/smart-iframe.js frontend/js/components/split-view.js
git commit -m "feat: remove smart-iframe.js and split-view.js — replaced by smart-window.js"
```

---

### Task 10: Update Root `requirements.txt`

**Files:**
- Modify: `requirements.txt` (root)

- [ ] **Step 1: Add pywebview to root requirements.txt**

```
fastapi>=0.110.0
uvicorn>=0.27.0
pydantic>=2.0.0
httpx>=0.27.0
pywebview>=5.0
```

Note: `httpx` (already listed) is used by `desktop_app.py` for server readiness polling. `pywebview` is only in root requirements.txt (desktop dependency), NOT in `backend/requirements.txt` (would break server/CI).

- [ ] **Step 2: Commit**

```bash
git add requirements.txt
git commit -m "feat: add pywebview to root requirements.txt"
```

---

### Task 11: Remove Combined View from Store (Cleanup)

**Note:** This task extends beyond the spec to clean up dead code left by the split-view removal.

**Files:**
- Modify: `frontend/js/store.js:6,151-156,181-207,247`

- [ ] **Step 1: Update tab type comment**

In `frontend/js/store.js`, replace line 6:

```javascript
        tabs: [],           // { id, url, title, isCombined, urls }
```

with:

```javascript
        tabs: [],           // { id, url, title, bookmarkId }
```

- [ ] **Step 2: Remove isCombined from openTab**

In `frontend/js/store.js`, in the `openTab` function, remove `isCombined: false,` from the tab object creation (line 156).

- [ ] **Step 3: Remove openCombinedTab and exitCombinedView functions**

Remove the `openCombinedTab` function (lines 181-195) and `exitCombinedView` function (lines 197-207).

- [ ] **Step 4: Remove exports**

In the return statement, remove `openCombinedTab, exitCombinedView` from the exported object.

- [ ] **Step 5: Commit**

```bash
git add frontend/js/store.js
git commit -m "feat: remove combined view code from store — split view no longer exists"
```

---

### Task 12: Integration Test — Full Startup Verification

- [ ] **Step 1: Install dependencies**

```bash
cd /Users/frank/workspace/bookmark_system
pip install pywebview httpx
```

- [ ] **Step 2: Run all backend tests**

Run: `cd /Users/frank/workspace/bookmark_system/backend && PYTHONPATH=. ./venv/bin/pytest ../tests/ -v --tb=short`
Expected: All remaining tests pass

- [ ] **Step 3: Verify desktop_app.py can be imported without errors**

```bash
cd /Users/frank/workspace/bookmark_system
python -c "
import sys, os
sys.path.insert(0, 'backend')
# Just verify the module parses and BookmarkBridge can be instantiated
exec(open('desktop_app.py').read().replace('if __name__', 'if False'))
print('Module parsed OK')
bridge = BookmarkBridge()
print('BookmarkBridge instantiated OK')
"
```

- [ ] **Step 4: Verify frontend loads in browser (dev mode fallback)**

Open `http://localhost:8765` in a browser (with FastAPI running separately) and verify:
- Dashboard loads
- Clicking a bookmark triggers `window.open()` fallback (since no pywebview)
- Tab bar shows tabs correctly
- No JS console errors

- [ ] **Step 5: Verify no untracked files were missed, then tag completion**

```bash
cd /Users/frank/workspace/bookmark_system
git status
```

No commit needed here — all changes committed in Tasks 1-11. This task is verification only.

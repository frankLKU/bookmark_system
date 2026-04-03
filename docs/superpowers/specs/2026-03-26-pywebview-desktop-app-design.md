# TIBDP Desktop App — pywebview Migration Design

## Goal

Replace iframe-based bookmark viewing with pywebview desktop application. Main dashboard window loads existing HTML/CSS/JS frontend, each bookmark opens in a child pywebview window that directly loads the target URL (no proxy needed). Deployable with `pip install -r requirements.txt && python desktop_app.py`.

## Architecture

```
┌─────────────────────────────────────┐
│  python desktop_app.py              │
│  ┌───────────────┐ ┌─────────────┐  │
│  │ FastAPI Server │ │  pywebview   │  │
│  │ (background   │ │  Main Window │  │
│  │  thread on    │ │  (dashboard) │  │
│  │  localhost:    │ │              │  │
│  │  8765)        │ │  JS Bridge   │  │
│  │               │ │  ↕           │  │
│  │  /api/v1/*    │ │  Python API  │  │
│  └───────────────┘ └──────┬──────┘  │
│                           │         │
│              ┌────────────┼───┐     │
│              ▼            ▼   ▼     │
│         ┌────────┐  ┌────────┐  ... │
│         │ Child  │  │ Child  │      │
│         │ Window │  │ Window │      │
│         │ (URL)  │  │ (URL)  │      │
│         └────────┘  └────────┘      │
└─────────────────────────────────────┘
```

- **Main window**: pywebview window loading `http://localhost:8765` (existing dashboard HTML)
- **Child windows**: pywebview windows loading bookmark URLs directly (no iframe, no proxy)
- **FastAPI**: Runs in background thread, serves API + static frontend
- **JS Bridge**: Python class exposed to JS as `window.pywebview.api`

## Platform Support

- **Windows**: EdgeChromium renderer (built into pywebview, no extra install)
- **macOS**: WebKit renderer (native)
- **Deployment target**: Windows with only Python available

## Threading Model

pywebview **must** run on the main thread. FastAPI/uvicorn runs in a daemon background thread.

- **Main thread**: `webview.start()` — blocks, owns the GUI event loop
- **Background thread**: uvicorn serving FastAPI on `localhost:8765`
- **JS bridge calls**: Execute in separate background threads managed by pywebview
- **Window creation from bridge**: Must be dispatched to main thread. Use `webview.create_window()` which is documented as thread-safe after `start()` — pywebview internally dispatches to the GUI thread.
- **`evaluate_js` from bridge**: Thread-safe per pywebview docs, but must guard against calling on destroyed windows.

## Components

### 1. `desktop_app.py` — Application Entry Point

Responsibilities:
- Check for single instance (try binding port 8765, fail fast if taken)
- Start FastAPI/uvicorn in a daemon background thread on `localhost:8765`
- Wait for server readiness: poll `http://localhost:8765/api/v1/bookmarks` with max 20 retries at 0.5s intervals (10s timeout). Show error dialog and exit on failure.
- Create main pywebview window loading `http://localhost:8765`
- Expose `BookmarkBridge` JS API class to the main window
- On main window close: close all child windows, signal uvicorn shutdown

### 2. `BookmarkBridge` — JS Bridge API Class

Exposed to JavaScript as `window.pywebview.api`:

```python
import json
import webview

class BookmarkBridge:
    def __init__(self):
        self._windows = {}  # tab_id -> webview.Window
        self._main_window = None  # Injected after main window creation

    def set_main_window(self, window):
        """Called by desktop_app.py after creating the main window."""
        self._main_window = window

    def open_bookmark(self, tab_id, url, title):
        """Open a child window for a bookmark. If already open, focus it."""
        if tab_id in self._windows:
            self._focus_window(tab_id)
            return
        window = webview.create_window(
            title, url,
            width=1200, height=800
        )
        window.events.closed += lambda: self._on_child_closed(tab_id)
        self._windows[tab_id] = window

    def close_bookmark(self, tab_id):
        """Close a child window."""
        if tab_id in self._windows:
            window = self._windows.pop(tab_id)
            window.destroy()

    def focus_bookmark(self, tab_id):
        """Bring a child window to front."""
        self._focus_window(tab_id)

    def close_all(self):
        """Close all child windows."""
        for w in list(self._windows.values()):
            w.destroy()
        self._windows.clear()

    def _focus_window(self, tab_id):
        """Focus a child window. Uses minimize+restore trick for reliable foregrounding."""
        if tab_id in self._windows:
            w = self._windows[tab_id]
            w.show()
            w.minimize()
            w.restore()

    def _on_child_closed(self, tab_id):
        """Called when user closes a child window manually.
        Runs in a background thread (pywebview event handler).
        """
        self._windows.pop(tab_id, None)
        # Notify main window JS to remove the tab
        # Guard: main window may already be destroyed during app shutdown
        try:
            if self._main_window:
                self._main_window.evaluate_js(
                    f"if(typeof Store!=='undefined')Store.closeTab({json.dumps(tab_id)})"
                )
        except Exception:
            pass  # Main window already destroyed
```

### 3. `smart-window.js` — Replaces `smart-iframe.js`

**Critical**: `window.pywebview.api` is NOT available at `DOMContentLoaded`. It becomes available after the `pywebviewready` DOM event fires. All bridge calls must either:
- Be triggered by user interaction (click handlers fire after init), or
- Wait for `pywebviewready` event

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
        // Show status card in content area (not iframe)
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

### 4. Tab Bar Behavior Changes

- Click tab → calls `SmartWindow.focusBookmark(tab_id)` to bring child window to front
- Close tab → calls `SmartWindow.closeBookmark(tab_id)` to close child window
- When user closes child window directly → `_on_child_closed` fires → `Store.closeTab()` removes tab
- Main window content area shows status card for active tab

## Files Changed

### New Files
- `desktop_app.py` — pywebview entry point with BookmarkBridge
- `frontend/js/components/smart-window.js` — replaces smart-iframe.js

### Modified Files
- `frontend/index.html` — replace smart-iframe.js script tag with smart-window.js, remove split-view.js
- `frontend/js/store.js` — add `closeTab(tabId)` method callable from Python bridge
- `frontend/js/components/tab-bar.js` — use SmartWindow API instead of SmartIframe
- `frontend/js/app.js` — remove SplitView init, replace SmartIframe with SmartWindow
- `frontend/css/components.css` — remove iframe-related styles, add window-status-card styles
- `requirements.txt` (root) — add pywebview
- `backend/app/main.py` — remove proxy router include

### Removed Files
- `frontend/js/components/smart-iframe.js` — replaced by smart-window.js
- `frontend/js/components/split-view.js` — no longer needed
- `backend/app/routers/proxy.py` — no longer needed
- `tests/tibdp/backend/test_api_proxy.py` — no longer needed

### NOT Modified
- `backend/requirements.txt` — pywebview is a desktop dependency, NOT a backend dependency (would break server/CI environments)

### Unchanged
- `backend/app/routers/bookmarks.py`, `categories.py`, `import_export.py`, `health.py`
- `backend/app/database.py`, `backend/app/models.py`
- `frontend/js/api.js`, `frontend/js/router.js`
- `frontend/js/components/sidebar.js`, `modal.js`, `workspace-bar.js`
- `frontend/js/utils/*` — all unchanged
- All CSS except iframe-related styles

## Startup Flow

```
python desktop_app.py
  │
  ├─ Try binding port 8765 (fail fast if already in use)
  ├─ Start uvicorn in daemon background thread (port 8765)
  ├─ Poll http://localhost:8765/api/v1/bookmarks
  │    max 20 retries × 0.5s = 10s timeout
  │    on failure: show error dialog, sys.exit(1)
  ├─ Create BookmarkBridge instance
  ├─ Create main pywebview window → http://localhost:8765
  │    js_api=bridge
  ├─ bridge.set_main_window(main_window)
  └─ webview.start()  ← blocks until main window closed
       └─ On close: bridge.close_all(), signal uvicorn shutdown
```

## Content Area UX

When a bookmark is opened:
- Child window appears with the actual website
- Main window content area shows a status card:
  - Bookmark title
  - "Opened in separate window"
  - "Focus Window" button → `focus_bookmark()`
  - "Close Window" button → `close_bookmark()`

When no tabs are open:
- Empty state (same as current)

## Known Limitations

- **Window focus**: `minimize()` + `restore()` trick works reliably on Windows. On macOS, bringing a window to foreground may not work consistently due to OS restrictions. This is a known pywebview limitation.
- **Vercel/browser mode**: The web frontend still works in a regular browser with `window.open()` fallback, but this is a development convenience, not a supported deployment target.

## Error Handling

- **Port 8765 already in use**: Show error dialog "Another instance is already running", exit
- **Server fails to start within 10s**: Show error dialog with details, exit
- **Child window URL fails to load**: pywebview's browser engine shows its own error page
- **Main window closed**: All child windows destroyed, server stopped, process exits
- **Bridge calls on destroyed windows**: Wrapped in try/except, silently ignored

## Dependencies

```
# requirements.txt (root — desktop app)
fastapi>=0.110.0
uvicorn>=0.27.0
pydantic>=2.0.0
httpx>=0.27.0
pywebview>=5.0
```

```
# backend/requirements.txt (server-only — NO pywebview)
fastapi>=0.110.0
uvicorn>=0.27.0
pydantic>=2.0.0
httpx>=0.27.0
```

## Testing

- Backend tests: unchanged (64 tests, minus 3 proxy tests = 61 tests)
- Frontend unit tests: unchanged (13 tests)
- Remove `tests/tibdp/backend/test_api_proxy.py`
- New: manual testing of pywebview window lifecycle
- Future: Playwright E2E tests for the desktop app

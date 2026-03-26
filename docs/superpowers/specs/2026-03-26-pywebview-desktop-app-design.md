# TIBDP Desktop App — pywebview Migration Design

## Goal

Replace iframe-based bookmark viewing with pywebview desktop application. Main dashboard window loads existing HTML/CSS/JS frontend, each bookmark opens in a child pywebview window that directly loads the target URL (no proxy needed). Deployable with `pip install -r requirements.txt && python main.py`.

## Architecture

```
┌─────────────────────────────────────┐
│  python main.py                     │
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

## Components

### 1. `desktop_app.py` — Application Entry Point

Responsibilities:
- Start FastAPI/uvicorn in a background thread on `localhost:8765`
- Wait for server to be ready (poll health endpoint)
- Create main pywebview window loading `http://localhost:8765`
- Expose `BookmarkBridge` JS API class to the main window
- On main window close: close all child windows and shut down server

### 2. `BookmarkBridge` — JS Bridge API Class

Exposed to JavaScript as `window.pywebview.api`:

```python
class BookmarkBridge:
    def __init__(self):
        self._windows = {}  # tab_id -> webview.Window

    def open_bookmark(self, tab_id, url, title):
        """Open a child window for a bookmark. If already open, focus it."""
        if tab_id in self._windows:
            self._windows[tab_id].show()
            self._windows[tab_id].restore()
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
            self._windows[tab_id].destroy()
            del self._windows[tab_id]

    def focus_bookmark(self, tab_id):
        """Bring a child window to front."""
        if tab_id in self._windows:
            self._windows[tab_id].show()
            self._windows[tab_id].restore()

    def close_all(self):
        """Close all child windows."""
        for w in list(self._windows.values()):
            w.destroy()
        self._windows.clear()

    def _on_child_closed(self, tab_id):
        """Called when user closes a child window manually."""
        self._windows.pop(tab_id, None)
        # Notify main window JS to remove the tab
        main_window.evaluate_js(f"Store.closeTab('{tab_id}')")
```

### 3. `smart-window.js` — Replaces `smart-iframe.js`

Instead of creating iframes, calls the JS bridge:

```javascript
function openBookmark(tabId, url, title) {
    if (window.pywebview) {
        window.pywebview.api.open_bookmark(tabId, url, title);
    } else {
        // Fallback for browser-based development
        window.open(url, '_blank');
    }
}
```

The content area in the main window shows a simple status card ("Opened in separate window") instead of an iframe.

### 4. Tab Bar Behavior Changes

- Click tab → calls `focus_bookmark(tab_id)` to bring child window to front
- Close tab → calls `close_bookmark(tab_id)` to close child window
- When user closes child window directly → `_on_child_closed` fires → removes tab from Store
- Main window content area shows which bookmark is "active" but actual content is in child window

## Files Changed

### New Files
- `desktop_app.py` — pywebview entry point with BookmarkBridge
- `frontend/js/components/smart-window.js` — replaces smart-iframe.js

### Modified Files
- `frontend/index.html` — replace smart-iframe.js script tag with smart-window.js, remove split-view.js
- `frontend/js/store.js` — add `closeTab(tabId)` method callable from Python bridge
- `frontend/js/components/tab-bar.js` — use smart-window API instead of iframe
- `frontend/js/app.js` — remove SplitView init, update SmartIframe references
- `frontend/css/components.css` — remove iframe-related styles, add status card styles
- `requirements.txt` — add pywebview
- `backend/requirements.txt` — add pywebview

### Removed Files
- `frontend/js/components/smart-iframe.js` — replaced by smart-window.js
- `frontend/js/components/split-view.js` — no longer needed
- `backend/app/routers/proxy.py` — no longer needed (child windows load URLs directly)

### Unchanged
- `backend/app/routers/bookmarks.py` — all CRUD unchanged
- `backend/app/routers/categories.py` — unchanged
- `backend/app/routers/import_export.py` — unchanged
- `backend/app/routers/health.py` — unchanged (still checks URL health via httpx)
- `backend/app/database.py` — unchanged
- `backend/app/models.py` — unchanged
- `frontend/js/api.js` — unchanged
- `frontend/js/router.js` — unchanged
- `frontend/js/components/sidebar.js` — unchanged
- `frontend/js/components/modal.js` — unchanged
- `frontend/js/components/workspace-bar.js` — unchanged
- `frontend/js/utils/*` — all unchanged
- All CSS except iframe-related styles — unchanged

## Startup Flow

```
python desktop_app.py
  │
  ├─ Start uvicorn in background thread (port 8765)
  ├─ Poll http://localhost:8765/api/v1/bookmarks until ready
  ├─ Create main pywebview window → http://localhost:8765
  │    └─ JS Bridge: BookmarkBridge exposed as window.pywebview.api
  └─ webview.start()  ← blocks until main window closed
       └─ On close: destroy all child windows, stop server
```

## Content Area UX

When a bookmark is opened:
- Child window appears with the actual website
- Main window content area shows a status card:
  - Bookmark title
  - "Opened in separate window"
  - "Focus Window" button (calls focus_bookmark)
  - "Close" button (calls close_bookmark)

When no tabs are open:
- Empty state (same as current)

## Error Handling

- **Server fails to start**: Show error dialog, exit
- **Child window URL fails to load**: pywebview shows its own error page (browser engine handles it)
- **Main window closed**: All child windows destroyed, server stopped, process exits

## Dependencies

```
# requirements.txt
fastapi>=0.110.0
uvicorn>=0.27.0
pydantic>=2.0.0
httpx>=0.27.0
pywebview>=5.0
```

## Testing

- Backend tests: unchanged (64 tests)
- Frontend unit tests: unchanged (13 tests)
- Remove proxy-related tests (test_api_proxy.py)
- New: manual testing of pywebview window lifecycle
- Future: Playwright E2E tests for the desktop app

## Migration Notes

- Vercel deployment no longer applicable (this is a desktop app)
- `api/index.py` and `vercel.json` can remain for web-only fallback
- The HTML/JS frontend still works in a regular browser — smart-window.js has a `window.open()` fallback when pywebview is not detected

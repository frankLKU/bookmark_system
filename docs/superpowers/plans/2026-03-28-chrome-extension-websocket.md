# Chrome Extension + WebSocket Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Chrome Extension + WebSocket integration so the pywebview menubar app can control Chrome tabs and tab groups.

**Architecture:** Python FastAPI adds a WebSocket endpoint. A Chrome Extension (Manifest V3) connects via WebSocket, receives commands (open tab group, switch/close tab), and pushes tab state updates back. The frontend gets a new Chrome tab panel and "open in Chrome" buttons on workspace tags. Frontend communicates with the extension via REST endpoints on the backend (which forwards commands through the WebSocket).

**Tech Stack:** FastAPI WebSocket, Chrome Extension Manifest V3 (chrome.tabs, chrome.tabGroups APIs), pywebview, pyobjc (macOS focus)

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `backend/app/routers/websocket.py` | WebSocket endpoint `/ws/chrome`, REST endpoints `/chrome/*`, single-client policy, message routing |
| `chrome-extension/manifest.json` | Extension metadata, permissions, service worker + content script registration |
| `chrome-extension/background.js` | WebSocket client, command handler (open_tab_group, switch_tab, close_tab, close_group), tab event listeners, tagToGroupId map |
| `chrome-extension/content.js` | "/" keypress listener, forwards to background.js |
| `frontend/js/components/chrome-tabs.js` | Chrome tab panel UI component — displays tab groups and tabs from REST polling |
| `tests/tibdp/backend/test_websocket.py` | WebSocket endpoint + REST endpoint tests using Starlette TestClient |

### Modified Files
| File | Changes |
|------|---------|
| `backend/app/main.py` | Import and mount WebSocket router (with prefix for REST, without for WS) |
| `frontend/js/store.js` | Add `chromeTabs` state, `chromeConnected` flag, chrome command methods via REST |
| `frontend/js/components/workspace-bar.js` | Add "open in Chrome" icon button per tag chip |
| `frontend/js/app.js` | Init ChromeTabs component |
| `frontend/index.html` | Add chrome-tabs.js script tag, chrome-tabs-panel div in sidebar, connection indicator |
| `frontend/css/components.css` | Styles for chrome tab panel, connection indicator, open-in-chrome button |
| `desktop_app.py` | Store window reference, add thread-safe focus handler |

---

### Task 1: WebSocket Server Endpoint + Tests

**Files:**
- Create: `backend/app/routers/websocket.py`
- Create: `tests/tibdp/backend/test_websocket.py`
- Modify: `backend/app/main.py:9-30`

- [ ] **Step 1: Write failing tests for WebSocket endpoint**

```python
# tests/tibdp/backend/test_websocket.py
import json
import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect


@pytest.fixture(autouse=True)
def reset_chrome_manager():
    """Reset the chrome_manager singleton between tests to prevent state leaks."""
    from app.routers.websocket import chrome_manager
    chrome_manager._ws = None
    chrome_manager._tabs = []
    chrome_manager._on_focus_search = None
    yield
    chrome_manager._ws = None
    chrome_manager._tabs = []
    chrome_manager._on_focus_search = None


class TestWebSocketEndpoint:
    def test_connect_and_receive_message(self, client):
        """Extension connects and sends a message."""
        with client.websocket_connect("/ws/chrome") as ws:
            ws.send_json({"type": "connected"})
            # Connection should stay open (no exception)

    def test_tabs_updated_event(self, client):
        """Extension sends tabs_updated, server stores state."""
        from app.routers.websocket import chrome_manager

        with client.websocket_connect("/ws/chrome") as ws:
            ws.send_json({
                "type": "tabs_updated",
                "data": {"tabs": [{"id": 1, "url": "https://example.com", "title": "Example", "groupId": -1, "groupName": ""}]}
            })
        # After disconnect, verify tabs were stored
        assert len(chrome_manager.tabs) == 1
        assert chrome_manager.tabs[0]["id"] == 1

    def test_single_client_policy(self, client):
        """New connection replaces the old one — manager tracks latest only."""
        from app.routers.websocket import chrome_manager

        with client.websocket_connect("/ws/chrome") as ws1:
            ws1.send_json({"type": "connected"})
            assert chrome_manager.connected is True

            with client.websocket_connect("/ws/chrome") as ws2:
                ws2.send_json({"type": "connected"})
                # Manager should now track ws2, not ws1
                assert chrome_manager.connected is True
                # Send tabs_updated via ws2 to verify it's the active connection
                ws2.send_json({
                    "type": "tabs_updated",
                    "data": {"tabs": [{"id": 99, "url": "https://test.com", "title": "Test", "groupId": -1, "groupName": ""}]}
                })
        assert chrome_manager.tabs[0]["id"] == 99

    def test_focus_search_event(self, client):
        """Extension sends focus_search event, callback is invoked."""
        from app.routers.websocket import chrome_manager

        called = []
        chrome_manager.set_focus_callback(lambda: called.append(True))

        with client.websocket_connect("/ws/chrome") as ws:
            ws.send_json({"type": "focus_search"})

        assert len(called) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/frank/workspace/bookmark_system && .venv/bin/python -m pytest tests/tibdp/backend/test_websocket.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.routers.websocket'`

- [ ] **Step 3: Implement WebSocket endpoint**

```python
# backend/app/routers/websocket.py
"""WebSocket endpoint for Chrome Extension communication."""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter()


class ChromeConnectionManager:
    """Manages the single WebSocket connection to Chrome Extension."""

    def __init__(self):
        self._ws: WebSocket | None = None
        self._tabs: list[dict] = []
        self._on_focus_search = None  # callback

    @property
    def connected(self) -> bool:
        return self._ws is not None

    @property
    def tabs(self) -> list[dict]:
        return self._tabs

    async def connect(self, websocket: WebSocket):
        """Accept new connection, close previous if exists (single-client policy)."""
        if self._ws is not None:
            try:
                await self._ws.close()
            except Exception:
                pass
        self._ws = websocket

    def disconnect(self):
        self._ws = None

    async def send_command(self, cmd_type: str, data: dict):
        """Send a command to the Chrome Extension."""
        if self._ws is None:
            logger.warning("No Chrome Extension connected, cannot send: %s", cmd_type)
            return
        await self._ws.send_json({"type": cmd_type, "data": data})

    def handle_tabs_updated(self, data: dict):
        self._tabs = data.get("tabs", [])

    def set_focus_callback(self, callback):
        self._on_focus_search = callback


chrome_manager = ChromeConnectionManager()


@router.websocket("/ws/chrome")
async def chrome_websocket(websocket: WebSocket):
    await websocket.accept()
    await chrome_manager.connect(websocket)
    logger.info("Chrome Extension connected")

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "tabs_updated":
                chrome_manager.handle_tabs_updated(msg.get("data", {}))

            elif msg_type == "focus_search":
                if chrome_manager._on_focus_search:
                    chrome_manager._on_focus_search()

            elif msg_type == "connected":
                logger.info("Chrome Extension handshake received")

    except WebSocketDisconnect:
        chrome_manager.disconnect()
        logger.info("Chrome Extension disconnected")
    except Exception as e:
        chrome_manager.disconnect()
        logger.error("WebSocket error: %s", e)
```

- [ ] **Step 4: Mount WebSocket router in main.py**

In `backend/app/main.py`:

```python
# Line 9: add websocket to imports
from app.routers import bookmarks, categories, import_export, health, websocket

# After line 30: mount WebSocket router (no prefix — path is /ws/chrome)
app.include_router(websocket.router, tags=["websocket"])
```

Note: This will be split into `ws_router` + `rest_router` in Task 2 when REST endpoints are added.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/frank/workspace/bookmark_system && .venv/bin/python -m pytest tests/tibdp/backend/test_websocket.py -v`
Expected: PASS

- [ ] **Step 6: Run full test suite to ensure no regressions**

Run: `cd /Users/frank/workspace/bookmark_system && .venv/bin/python -m pytest tests/tibdp/backend/ -v`
Expected: All tests PASS (61 existing + new WebSocket tests)

- [ ] **Step 7: Commit**

```bash
cd /Users/frank/workspace/bookmark_system
git add backend/app/routers/websocket.py tests/tibdp/backend/test_websocket.py backend/app/main.py
git commit -m "feat: add WebSocket endpoint for Chrome Extension communication"
```

---

### Task 2: Chrome REST Endpoints for Frontend Commands

**Files:**
- Modify: `backend/app/routers/websocket.py`
- Add tests to: `tests/tibdp/backend/test_websocket.py`

The frontend cannot use the WebSocket directly (it's reserved for the Extension). Instead, the frontend sends commands via REST endpoints, which the backend forwards through the WebSocket.

- [ ] **Step 1: Write failing tests for REST endpoints**

Add to `tests/tibdp/backend/test_websocket.py`:

```python
class TestChromeRestEndpoints:
    def test_get_tabs_no_extension(self, client):
        """Get tabs when no extension is connected."""
        resp = client.get("/api/v1/chrome/tabs")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["connected"] is False
        assert data["data"]["tabs"] == []

    def test_get_tabs_with_extension(self, client):
        """Get tabs after extension sends tabs_updated."""
        from app.routers.websocket import chrome_manager

        with client.websocket_connect("/ws/chrome") as ws:
            ws.send_json({
                "type": "tabs_updated",
                "data": {"tabs": [{"id": 1, "url": "https://example.com", "title": "Example", "groupId": -1, "groupName": ""}]}
            })
            resp = client.get("/api/v1/chrome/tabs")
            assert resp.status_code == 200
            data = resp.json()
            assert data["data"]["connected"] is True
            assert len(data["data"]["tabs"]) == 1

    def test_open_tab_group_command(self, client):
        """Send open_tab_group command via REST."""
        with client.websocket_connect("/ws/chrome") as ws:
            resp = client.post("/api/v1/chrome/open-tab-group", json={
                "tag": "f14",
                "urls": ["https://example.com"]
            })
            assert resp.status_code == 200
            assert resp.json()["success"] is True
            msg = ws.receive_json()
            assert msg["type"] == "open_tab_group"
            assert msg["data"]["tag"] == "f14"
            assert msg["data"]["urls"] == ["https://example.com"]

    def test_switch_tab_command(self, client):
        """Send switch_tab command via REST."""
        with client.websocket_connect("/ws/chrome") as ws:
            resp = client.post("/api/v1/chrome/switch-tab", json={"tabId": 42})
            assert resp.status_code == 200
            msg = ws.receive_json()
            assert msg["type"] == "switch_tab"
            assert msg["data"]["tabId"] == 42

    def test_close_tab_command(self, client):
        """Send close_tab command via REST."""
        with client.websocket_connect("/ws/chrome") as ws:
            resp = client.post("/api/v1/chrome/close-tab", json={"tabId": 42})
            assert resp.status_code == 200
            msg = ws.receive_json()
            assert msg["type"] == "close_tab"

    def test_close_group_command(self, client):
        """Send close_group command via REST."""
        with client.websocket_connect("/ws/chrome") as ws:
            resp = client.post("/api/v1/chrome/close-group", json={"tag": "f14"})
            assert resp.status_code == 200
            msg = ws.receive_json()
            assert msg["type"] == "close_group"

    def test_command_when_not_connected(self, client):
        """Commands when no extension connected return success=false."""
        resp = client.post("/api/v1/chrome/open-tab-group", json={
            "tag": "f14",
            "urls": ["https://example.com"]
        })
        assert resp.status_code == 200
        assert resp.json()["success"] is False
        assert "not connected" in resp.json()["message"].lower()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/frank/workspace/bookmark_system && .venv/bin/python -m pytest tests/tibdp/backend/test_websocket.py::TestChromeRestEndpoints -v`
Expected: FAIL — routes not found (404)

- [ ] **Step 3: Add REST endpoints and Pydantic models to websocket.py**

Add to `backend/app/routers/websocket.py` (after the WebSocket handler):

```python
from pydantic import BaseModel


# --- Pydantic request models ---
class OpenTabGroupRequest(BaseModel):
    tag: str
    urls: list[str]
    color: str | None = None


class TabIdRequest(BaseModel):
    tabId: int


class TagRequest(BaseModel):
    tag: str


# --- REST endpoints: frontend → backend → extension ---
@router.get("/chrome/tabs")
def get_chrome_tabs():
    return {
        "success": True,
        "data": {
            "connected": chrome_manager.connected,
            "tabs": chrome_manager.tabs,
        },
        "message": "OK",
    }


@router.post("/chrome/open-tab-group")
async def open_tab_group(req: OpenTabGroupRequest):
    if not chrome_manager.connected:
        return {"success": False, "data": None, "message": "Chrome Extension not connected"}
    await chrome_manager.send_command("open_tab_group", {
        "tag": req.tag,
        "urls": req.urls,
        "color": req.color,
    })
    return {"success": True, "data": None, "message": "Command sent"}


@router.post("/chrome/switch-tab")
async def switch_tab(req: TabIdRequest):
    if not chrome_manager.connected:
        return {"success": False, "data": None, "message": "Chrome Extension not connected"}
    await chrome_manager.send_command("switch_tab", {"tabId": req.tabId})
    return {"success": True, "data": None, "message": "Command sent"}


@router.post("/chrome/close-tab")
async def close_tab(req: TabIdRequest):
    if not chrome_manager.connected:
        return {"success": False, "data": None, "message": "Chrome Extension not connected"}
    await chrome_manager.send_command("close_tab", {"tabId": req.tabId})
    return {"success": True, "data": None, "message": "Command sent"}


@router.post("/chrome/close-group")
async def close_group(req: TagRequest):
    if not chrome_manager.connected:
        return {"success": False, "data": None, "message": "Chrome Extension not connected"}
    await chrome_manager.send_command("close_group", {"tag": req.tag})
    return {"success": True, "data": None, "message": "Command sent"}
```

- [ ] **Step 4: Split into two routers and update main.py**

The WebSocket path (`/ws/chrome`) needs no prefix, but REST paths (`/chrome/*`) need `/api/v1` prefix. Split into two routers in `websocket.py`:

In `backend/app/routers/websocket.py`, replace the single `router = APIRouter()` with:

```python
ws_router = APIRouter()    # WebSocket — mounted without prefix
rest_router = APIRouter()  # REST — mounted with /api/v1 prefix
```

Change `@router.websocket("/ws/chrome")` to `@ws_router.websocket("/ws/chrome")`.
Change all `@router.get`/`@router.post` to use `@rest_router.get`/`@rest_router.post`.

In `backend/app/main.py`, the websocket import was already added in Task 1. Replace the single router mount line with:

```python
app.include_router(websocket.ws_router, tags=["websocket"])
app.include_router(websocket.rest_router, prefix="/api/v1", tags=["chrome"])
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/frank/workspace/bookmark_system && .venv/bin/python -m pytest tests/tibdp/backend/test_websocket.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/frank/workspace/bookmark_system
git add backend/app/routers/websocket.py tests/tibdp/backend/test_websocket.py backend/app/main.py
git commit -m "feat: add REST endpoints for Chrome tab commands"
```

---

### Task 3: Chrome Extension — manifest.json

**Files:**
- Create: `chrome-extension/manifest.json`

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "TIBDP Chrome Controller",
  "description": "Controls Chrome tabs and tab groups from TIBDP bookmark manager",
  "version": "1.0",
  "permissions": ["tabs", "tabGroups", "activeTab"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content.js"]
  }]
}
```

- [ ] **Step 2: Verify JSON is valid**

Run: `cd /Users/frank/workspace/bookmark_system && python3 -c "import json; json.load(open('chrome-extension/manifest.json')); print('Valid JSON')"`
Expected: `Valid JSON`

- [ ] **Step 3: Commit**

```bash
cd /Users/frank/workspace/bookmark_system
git add chrome-extension/manifest.json
git commit -m "feat: add Chrome Extension manifest (Manifest V3)"
```

---

### Task 4: Chrome Extension — background.js

**Files:**
- Create: `chrome-extension/background.js`

- [ ] **Step 1: Implement background.js**

```javascript
// chrome-extension/background.js
// WebSocket client + Chrome tab/group command handler

const WS_URL = 'ws://127.0.0.1:8765/ws/chrome';
const RECONNECT_INTERVAL = 3000;
const TAB_GROUP_COLORS = ['grey','blue','red','yellow','green','pink','purple','cyan','orange'];

let ws = null;
let tagToGroupId = {};  // All keys stored in lowercase

// --- Hash function for deterministic color assignment ---
function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function getColorForTag(tag) {
    return TAB_GROUP_COLORS[hashCode(tag) % TAB_GROUP_COLORS.length];
}

// --- WebSocket Connection ---
function connect() {
    try {
        ws = new WebSocket(WS_URL);
    } catch (e) {
        scheduleReconnect();
        return;
    }

    ws.onopen = () => {
        console.log('[TIBDP] Connected to server');
        ws.send(JSON.stringify({ type: 'connected' }));
        rebuildTagMap();
        sendTabsUpdate();
    };

    ws.onmessage = (event) => {
        let msg;
        try {
            msg = JSON.parse(event.data);
        } catch (e) {
            console.error('[TIBDP] Invalid JSON:', event.data);
            return;
        }
        handleCommand(msg);
    };

    ws.onclose = () => {
        console.log('[TIBDP] Disconnected, reconnecting...');
        ws = null;
        scheduleReconnect();
    };

    ws.onerror = () => {
        // onclose will fire after this
    };
}

function scheduleReconnect() {
    setTimeout(connect, RECONNECT_INTERVAL);
}

function send(type, data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type, data }));
    }
}

// --- Command Handler ---
async function handleCommand(msg) {
    const { type, data } = msg;

    switch (type) {
        case 'open_tab_group':
            await openTabGroup(data.tag, data.urls, data.color);
            break;
        case 'switch_tab':
            await switchTab(data.tabId);
            break;
        case 'close_tab':
            await closeTab(data.tabId);
            break;
        case 'close_group':
            await closeGroup(data.tag);
            break;
        default:
            console.warn('[TIBDP] Unknown command:', type);
    }
}

// --- Tab Group Operations ---
async function openTabGroup(tag, urls, color) {
    if (!urls || urls.length === 0) return;

    const tabIds = [];
    for (const url of urls) {
        const tab = await chrome.tabs.create({ url, active: false });
        tabIds.push(tab.id);
    }

    const groupId = await chrome.tabs.group({ tabIds });
    const groupColor = color || getColorForTag(tag);
    await chrome.tabGroups.update(groupId, { title: tag.toUpperCase(), color: groupColor });
    // Always store with lowercase key for consistent lookup
    tagToGroupId[tag.toLowerCase()] = groupId;

    // Activate first tab
    if (tabIds.length > 0) {
        await chrome.tabs.update(tabIds[0], { active: true });
    }

    sendTabsUpdate();
}

async function switchTab(tabId) {
    try {
        const tab = await chrome.tabs.get(tabId);
        await chrome.tabs.update(tabId, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
    } catch (e) {
        console.error('[TIBDP] switchTab failed:', e);
    }
}

async function closeTab(tabId) {
    try {
        await chrome.tabs.remove(tabId);
    } catch (e) {
        console.error('[TIBDP] closeTab failed:', e);
    }
    // tabs.onRemoved will trigger sendTabsUpdate
}

async function closeGroup(tag) {
    // Always look up with lowercase key
    const tagLower = tag.toLowerCase();
    let groupId = tagToGroupId[tagLower];

    // Fallback: search by title if map doesn't have it
    if (groupId === undefined) {
        const groups = await chrome.tabGroups.query({});
        const match = groups.find(g => g.title && g.title.toLowerCase() === tagLower);
        if (match) groupId = match.id;
    }

    if (groupId === undefined) {
        console.warn('[TIBDP] closeGroup: no group found for tag', tag);
        return;
    }

    const tabs = await chrome.tabs.query({ groupId });
    const tabIds = tabs.map(t => t.id);
    if (tabIds.length > 0) {
        await chrome.tabs.remove(tabIds);
    }
    delete tagToGroupId[tagLower];
    // tabs.onRemoved will trigger sendTabsUpdate
}

// --- Tab State Reporting ---
// Note: Sends tabs from ALL windows. Spec says "only manage most recently
// focused window" but showing all windows is acceptable for now.
async function sendTabsUpdate() {
    try {
        const tabs = await chrome.tabs.query({});
        const tabData = [];

        // Collect unique groupIds that need name resolution
        const groupIds = new Set(tabs.filter(t => t.groupId !== -1).map(t => t.groupId));
        const groupNames = {};
        for (const gid of groupIds) {
            try {
                const group = await chrome.tabGroups.get(gid);
                groupNames[gid] = group.title || '';
            } catch (e) {
                groupNames[gid] = '';
            }
        }

        for (const tab of tabs) {
            tabData.push({
                id: tab.id,
                url: tab.url || '',
                title: tab.title || '',
                groupId: tab.groupId,
                groupName: tab.groupId !== -1 ? (groupNames[tab.groupId] || '') : '',
                active: tab.active,
                windowId: tab.windowId,
            });
        }

        send('tabs_updated', { tabs: tabData });
    } catch (e) {
        console.error('[TIBDP] sendTabsUpdate failed:', e);
    }
}

// --- Rebuild tag→groupId map on reconnect ---
// All keys stored lowercase for consistent lookup
async function rebuildTagMap() {
    try {
        const groups = await chrome.tabGroups.query({});
        tagToGroupId = {};
        for (const g of groups) {
            if (g.title) {
                tagToGroupId[g.title.toLowerCase()] = g.id;
            }
        }
    } catch (e) {
        console.error('[TIBDP] rebuildTagMap failed:', e);
    }
}

// --- Tab Event Listeners ---
chrome.tabs.onCreated.addListener(() => sendTabsUpdate());
chrome.tabs.onRemoved.addListener(() => sendTabsUpdate());
chrome.tabs.onActivated.addListener(() => sendTabsUpdate());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.title || changeInfo.url) sendTabsUpdate();
});

// --- Content Script Message Listener ---
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'focus_search') {
        send('focus_search');
    }
});

// --- Start ---
connect();
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/frank/workspace/bookmark_system && node -c chrome-extension/background.js`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/frank/workspace/bookmark_system
git add chrome-extension/background.js
git commit -m "feat: add Chrome Extension background service worker"
```

---

### Task 5: Chrome Extension — content.js

**Files:**
- Create: `chrome-extension/content.js`

- [ ] **Step 1: Implement content.js**

```javascript
// chrome-extension/content.js
// Listens for "/" keypress and forwards to background.js
// Note: preventDefault() will override "/" shortcuts in web apps
// (GitHub, YouTube, etc.) — accepted trade-off for global search focus.

document.addEventListener('keydown', (e) => {
    if (e.key !== '/') return;

    // Don't intercept when typing in input fields
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (document.activeElement?.isContentEditable) return;

    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'focus_search' });
});
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/frank/workspace/bookmark_system && node -c chrome-extension/content.js`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/frank/workspace/bookmark_system
git add chrome-extension/content.js
git commit -m "feat: add Chrome Extension content script for '/' hotkey"
```

---

### Task 6: Store.js — Chrome State + Command Methods

**Files:**
- Modify: `frontend/js/store.js`

- [ ] **Step 1: Add chrome state and command methods to Store**

1. Add to `state` object (after `keyboardNavIndex` at line 12):
```javascript
        chromeTabs: [],         // tabs from Chrome Extension via REST polling
        chromeConnected: false, // is Chrome Extension WebSocket connected?
```

2. Add chrome methods before the `return` block (around line 211):
```javascript
    // --- Chrome Extension commands (via REST → backend → WebSocket → extension) ---

    async function openInChrome(tag) {
        const bookmarks = state.bookmarks.filter(b =>
            b.tags && b.tags.some(t => t.toLowerCase() === tag.toLowerCase())
        );
        const urls = bookmarks.map(b => b.url);
        if (urls.length === 0) return;

        await fetch('/api/v1/chrome/open-tab-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag, urls }),
        });
    }

    async function switchChromeTab(tabId) {
        await fetch('/api/v1/chrome/switch-tab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tabId }),
        });
    }

    async function closeChromeTab(tabId) {
        await fetch('/api/v1/chrome/close-tab', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tabId }),
        });
    }

    async function closeChromeGroup(tag) {
        await fetch('/api/v1/chrome/close-group', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tag }),
        });
    }

    async function loadChromeTabs() {
        try {
            const resp = await fetch('/api/v1/chrome/tabs');
            const data = await resp.json();
            if (data.success) {
                state.chromeTabs = data.data.tabs;
                state.chromeConnected = data.data.connected;
                emit('chromeTabs:changed', state.chromeTabs);
                emit('chromeConnected:changed', state.chromeConnected);
            }
        } catch (e) {
            state.chromeConnected = false;
            emit('chromeConnected:changed', false);
        }
    }
```

3. Add to the `return` block:
```javascript
        openInChrome, switchChromeTab, closeChromeTab, closeChromeGroup,
        loadChromeTabs,
```

- [ ] **Step 2: Verify no syntax errors**

Run: `cd /Users/frank/workspace/bookmark_system && node -c frontend/js/store.js`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/frank/workspace/bookmark_system
git add frontend/js/store.js
git commit -m "feat: add Chrome tab state and command methods to Store"
```

---

### Task 7: Chrome Connection Indicator + Tab Panel HTML/CSS

**Files:**
- Modify: `frontend/index.html:17-19`
- Modify: `frontend/css/components.css`

- [ ] **Step 1: Add connection indicator and chrome tab panel to index.html**

In `frontend/index.html`:

1. Add connection indicator inside workspace-bar (replace lines 17-19):
```html
  <!-- Factory Workspace Bar -->
  <div id="workspace-bar">
    <span id="chrome-status" class="chrome-status disconnected" title="Chrome Extension not connected"></span>
    <div class="workspace-chips"></div>
  </div>
```

2. Add chrome tab panel inside sidebar, after `sidebar-content` div (after line 44):
```html
      <!-- Chrome Tab Panel -->
      <div id="chrome-tabs-panel" class="chrome-tabs-panel">
        <div class="chrome-tabs-header">
          <span class="chrome-tabs-title">Chrome Tabs</span>
        </div>
        <div id="chrome-tabs-content" class="chrome-tabs-content">
          <!-- Rendered by ChromeTabs.js -->
        </div>
      </div>
```

3. Add script tag (before `smart-window.js` at line 119):
```html
  <script src="js/components/chrome-tabs.js" defer></script>
```

- [ ] **Step 2: Add CSS styles**

Add to end of `frontend/css/components.css`:

```css
/* --- Chrome Connection Indicator --- */
.chrome-status {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    display: inline-block;
    margin-right: var(--space-2);
    flex-shrink: 0;
}
.chrome-status.connected {
    background-color: var(--color-success);
}
.chrome-status.disconnected {
    background-color: var(--color-danger);
}

/* --- Chrome Tab Panel --- */
.chrome-tabs-panel {
    border-top: 1px solid var(--color-border);
    max-height: 40%;
    overflow-y: auto;
    flex-shrink: 0;
}
.chrome-tabs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-3);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.chrome-tabs-content {
    padding: 0 var(--space-2) var(--space-2);
}

.chrome-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-primary);
    border-radius: var(--radius-sm);
    margin-bottom: var(--space-1);
}
.chrome-group-header .group-color-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    display: inline-block;
    margin-right: var(--space-1);
}
.chrome-group-close {
    background: none;
    border: none;
    color: var(--color-text-tertiary);
    cursor: pointer;
    font-size: var(--font-size-xs);
    padding: 2px 4px;
    border-radius: var(--radius-sm);
}
.chrome-group-close:hover {
    background-color: var(--color-danger);
    color: white;
}

.chrome-tab-item {
    display: flex;
    align-items: center;
    padding: var(--space-1) var(--space-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    cursor: pointer;
    border-radius: var(--radius-sm);
    gap: var(--space-1);
}
.chrome-tab-item:hover {
    background-color: var(--color-bg-hover);
}
.chrome-tab-item .tab-title {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.chrome-tab-item .tab-close {
    background: none;
    border: none;
    color: var(--color-text-tertiary);
    cursor: pointer;
    font-size: 12px;
    padding: 0 2px;
    border-radius: var(--radius-sm);
    opacity: 0;
}
.chrome-tab-item:hover .tab-close {
    opacity: 1;
}
.chrome-tab-item .tab-close:hover {
    color: var(--color-danger);
}

/* Open in Chrome button on workspace chips */
.workspace-chip .open-in-chrome {
    margin-left: 4px;
    background: none;
    border: none;
    color: var(--color-text-tertiary);
    cursor: pointer;
    font-size: 10px;
    padding: 0 2px;
    border-radius: var(--radius-sm);
    opacity: 0;
    transition: opacity var(--transition-fast);
}
.workspace-chip:hover .open-in-chrome {
    opacity: 1;
}
.workspace-chip .open-in-chrome:hover {
    color: var(--color-accent);
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/frank/workspace/bookmark_system
git add frontend/index.html frontend/css/components.css
git commit -m "feat: add Chrome connection indicator and tab panel HTML/CSS"
```

---

### Task 8: ChromeTabs Component (Frontend JS)

**Files:**
- Create: `frontend/js/components/chrome-tabs.js`

- [ ] **Step 1: Implement ChromeTabs component**

```javascript
// frontend/js/components/chrome-tabs.js
const ChromeTabs = (() => {
    let pollTimer = null;

    function init() {
        render();
        Store.on('chromeTabs:changed', render);
        Store.on('chromeConnected:changed', updateConnectionStatus);

        // Poll chrome tab state every 2 seconds
        pollTimer = setInterval(() => Store.loadChromeTabs(), 2000);
        Store.loadChromeTabs();
    }

    function updateConnectionStatus(connected) {
        const indicator = document.getElementById('chrome-status');
        if (!indicator) return;
        indicator.className = 'chrome-status ' + (connected ? 'connected' : 'disconnected');
        indicator.title = connected ? 'Chrome Extension connected' : 'Chrome Extension not connected';
    }

    function render() {
        const container = document.getElementById('chrome-tabs-content');
        if (!container) return;

        const { chromeTabs, chromeConnected } = Store.getState();

        if (!chromeConnected) {
            container.innerHTML = '<div class="chrome-tab-item" style="color:var(--color-text-tertiary);cursor:default;">Extension not connected</div>';
            return;
        }

        if (chromeTabs.length === 0) {
            container.innerHTML = '<div class="chrome-tab-item" style="cursor:default;">No tabs open</div>';
            return;
        }

        // Group tabs by groupName
        const groups = {};
        const ungrouped = [];

        chromeTabs.forEach(tab => {
            if (tab.groupId !== -1 && tab.groupName) {
                if (!groups[tab.groupName]) {
                    groups[tab.groupName] = [];
                }
                groups[tab.groupName].push(tab);
            } else {
                ungrouped.push(tab);
            }
        });

        let html = '';

        // Render groups
        Object.entries(groups).forEach(([groupName, tabs]) => {
            html += `
                <div class="chrome-group">
                    <div class="chrome-group-header">
                        <span><span class="group-color-dot"></span>${escapeHtml(groupName)}</span>
                        <button class="chrome-group-close" data-group="${escapeHtml(groupName)}" title="Close all tabs in this group">&times;</button>
                    </div>
                    ${tabs.map(tab => renderTab(tab)).join('')}
                </div>
            `;
        });

        // Render ungrouped tabs
        ungrouped.forEach(tab => {
            html += renderTab(tab);
        });

        container.innerHTML = html;

        // Attach event listeners
        container.querySelectorAll('.chrome-tab-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (e.target.closest('.tab-close')) return;
                const tabId = parseInt(el.dataset.tabId, 10);
                Store.switchChromeTab(tabId);
            });
        });

        container.querySelectorAll('.tab-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tabId = parseInt(btn.dataset.tabId, 10);
                Store.closeChromeTab(tabId);
            });
        });

        container.querySelectorAll('.chrome-group-close').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.dataset.group;
                Store.closeChromeGroup(group);
            });
        });
    }

    function renderTab(tab) {
        const title = tab.title || tab.url || 'Untitled';
        const activeClass = tab.active ? ' style="font-weight:600;"' : '';
        return `
            <div class="chrome-tab-item" data-tab-id="${tab.id}"${activeClass}>
                <span class="tab-title">${escapeHtml(title)}</span>
                <button class="tab-close" data-tab-id="${tab.id}" title="Close tab">&times;</button>
            </div>
        `;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    return { init };
})();
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/frank/workspace/bookmark_system && node -c frontend/js/components/chrome-tabs.js`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/frank/workspace/bookmark_system
git add frontend/js/components/chrome-tabs.js
git commit -m "feat: add ChromeTabs component for Chrome tab panel UI"
```

---

### Task 9: Workspace Bar — "Open in Chrome" Button

**Files:**
- Modify: `frontend/js/components/workspace-bar.js:24-47`

- [ ] **Step 1: Add "open in Chrome" icon to each tag chip**

In `frontend/js/components/workspace-bar.js`, modify the `render()` function:

1. Change the tag chip HTML (line 27) — replace:
```javascript
            html += `<button class="workspace-chip${active}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag.toUpperCase())}</button>`;
```
with:
```javascript
            html += `<button class="workspace-chip${active}" data-tag="${escapeHtml(tag)}">${escapeHtml(tag.toUpperCase())}<span class="open-in-chrome" data-chrome-tag="${escapeHtml(tag)}" title="Open all in Chrome">&#9654;</span></button>`;
```

2. Add click handler for the open-in-chrome buttons (after the contextmenu handler, around line 47):
```javascript
        // Open in Chrome buttons
        container.querySelectorAll('.open-in-chrome').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Don't trigger chip filter
                const tag = btn.dataset.chromeTag;
                if (typeof Store !== 'undefined' && Store.openInChrome) {
                    Store.openInChrome(tag);
                }
            });
        });
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/frank/workspace/bookmark_system && node -c frontend/js/components/workspace-bar.js`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/frank/workspace/bookmark_system
git add frontend/js/components/workspace-bar.js
git commit -m "feat: add 'open in Chrome' button to workspace tag chips"
```

---

### Task 10: App.js — Initialize ChromeTabs

**Files:**
- Modify: `frontend/js/app.js:26`

- [ ] **Step 1: Add ChromeTabs init**

In `frontend/js/app.js`, add after line 26 (`SmartWindow.init()`):

```javascript
    if (typeof ChromeTabs !== 'undefined' && ChromeTabs.init) ChromeTabs.init();
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/frank/workspace/bookmark_system && node -c frontend/js/app.js`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd /Users/frank/workspace/bookmark_system
git add frontend/js/app.js
git commit -m "feat: initialize ChromeTabs component on app startup"
```

---

### Task 11: desktop_app.py — Thread-Safe Focus Handling

**Files:**
- Modify: `desktop_app.py` (full file replacement)

The focus handler must be thread-safe because the WebSocket handler runs in uvicorn's async event loop (a background thread), but pywebview GUI calls must run on the main thread. We use `threading.Thread` to dispatch the focus action.

- [ ] **Step 1: Rewrite desktop_app.py with focus handling**

Replace the entire file with:

```python
"""TIBDP Desktop App — pywebview entry point.

Starts FastAPI in a background thread, then opens a pywebview main window
pointing at the local dashboard. Bookmarks open in the system browser.
Chrome Extension communicates via WebSocket for tab group control.
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
# Focus handling (thread-safe)
# ---------------------------------------------------------------------------

def _bring_to_front(window):
    """Bring pywebview window to front and focus search box.

    Must be called from a separate thread (not the main GUI thread or the
    asyncio event loop thread). pywebview's evaluate_js dispatches to the
    main thread internally.
    """
    try:
        window.show()
        if platform.system() == "Darwin":
            try:
                from AppKit import NSApp  # pyobjc
                NSApp.activateIgnoringOtherApps_(True)
            except ImportError:
                pass  # pyobjc not installed, window.show() is best effort
        window.evaluate_js("document.querySelector('#search-input')?.focus()")
    except Exception:
        pass


def _setup_focus_callback(window):
    """Register the focus callback with the WebSocket manager.

    The callback is invoked from the asyncio event loop thread (WebSocket
    handler), so we dispatch _bring_to_front in a separate thread to avoid
    blocking the event loop and to let pywebview dispatch GUI calls safely.
    """
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    from app.routers.websocket import chrome_manager

    def on_focus_search():
        threading.Thread(
            target=_bring_to_front,
            args=(window,),
            daemon=True,
        ).start()

    chrome_manager.set_focus_callback(on_focus_search)


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

    main_window = webview.create_window(
        "TIBDP — Bookmark Dashboard",
        f"http://{HOST}:{PORT}",
        width=1400,
        height=900,
    )

    def on_closed():
        server.should_exit = True

    def on_shown():
        _setup_focus_callback(main_window)

    main_window.events.closed += on_closed
    main_window.events.shown += on_shown
    webview.start()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Verify syntax**

Run: `cd /Users/frank/workspace/bookmark_system && .venv/bin/python -c "import ast; ast.parse(open('desktop_app.py').read()); print('Valid Python')"`
Expected: `Valid Python`

- [ ] **Step 3: Commit**

```bash
cd /Users/frank/workspace/bookmark_system
git add desktop_app.py
git commit -m "feat: add thread-safe pywebview focus handling for '/' hotkey"
```

---

### Task 12: Run All Tests + Manual Verification

- [ ] **Step 1: Run full backend test suite**

Run: `cd /Users/frank/workspace/bookmark_system && .venv/bin/python -m pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 2: Manual verification checklist**

1. Start app: `.venv/bin/python desktop_app.py`
2. Load `chrome-extension/` in Chrome via `chrome://extensions` → "Load unpacked"
3. Verify green dot appears in workspace bar (connection indicator)
4. Click a tag's ▶ button → Chrome should open a tab group with all bookmarks for that tag
5. Chrome tab panel in sidebar should show the opened tabs grouped by group name
6. Click a tab in the panel → Chrome should switch to it
7. Click × on a tab → Chrome should close it
8. Click "Close all" on a group → all tabs in group should close
9. Press "/" in Chrome (not in input field) → pywebview should come to front with search focused
10. Press "/" in pywebview → search should focus (existing keyboard-nav.js behavior)

- [ ] **Step 3: Push**

```bash
cd /Users/frank/workspace/bookmark_system
git push origin feature/tibdp
```

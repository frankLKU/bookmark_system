# TIBDP Chrome Extension + WebSocket Architecture Design

**Date:** 2026-03-28
**Status:** Approved
**Replaces:** pywebview child window approach (single main window retained)

## Goal

Transform TIBDP from a self-contained pywebview app into a menubar controller (20% screen) that drives Google Chrome (80% screen) via a Chrome Extension and WebSocket connection. Users can batch-open bookmarks by tag as Chrome tab groups, switch/close Chrome tabs from the menubar, and press "/" globally to focus the search box.

## Architecture Overview

Three components communicate via WebSocket:

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  Python App      │◄──────────────────►│ Chrome Extension  │
│  (pywebview)     │  ws://localhost    │  (Manifest V3)    │
│                  │     :8765/ws/      │                   │
│  - FastAPI       │     chrome         │  - background.js  │
│  - WebSocket srv │                    │  - content.js     │
│  - SQLite DB     │                    │  - chrome.tabs    │
│  - pywebview UI  │                    │  - chrome.tabGroups│
└─────────────────┘                    └──────────────────┘
```

- **Python App (menubar):** pywebview window, left 20% of screen. Hosts FastAPI backend with REST API + WebSocket server. The WebSocket endpoint lives inside the same FastAPI server on port 8765 (the existing app port).
- **Chrome Extension:** Manifest V3 extension. Background service worker connects to WebSocket server. Content script listens for "/" keypress. Controls Chrome tabs and tab groups.
- **WebSocket:** Bidirectional JSON messages between Python app and Chrome Extension on `ws://localhost:8765/ws/chrome`.
- **Connection policy:** Only one Extension client is accepted at a time. If a new WebSocket connection arrives, the previous one is closed.

## Chrome Extension Design

### File Structure

```
chrome-extension/
  manifest.json      — Manifest V3, permissions: tabs, tabGroups, activeTab
  background.js      — Service Worker, WebSocket client, chrome API operations
  content.js         — Injected into pages, listens for "/" keypress
```

### manifest.json

```json
{
  "manifest_version": 3,
  "name": "TIBDP Chrome Controller",
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

### background.js Responsibilities

1. **WebSocket Client** — connects to `ws://localhost:8765/ws/chrome`, auto-reconnects every 3 seconds on disconnect.
2. **Command Handler** — receives JSON commands from Python app, executes corresponding chrome API calls.
3. **Status Reporter** — sends `tabs_updated` events whenever tabs change (created, removed, activated, moved).
4. **State Management** — maintains an in-memory `tagToGroupId` map, populated when `open_tab_group` creates a group. On extension reload/crash, falls back to iterating all tab groups and matching by group title.

### Supported Commands (from Python app)

| Command | Data | Chrome API |
|---------|------|------------|
| `open_tab_group` | `{tag, urls[], color}` | `chrome.tabs.create()` per URL, then `chrome.tabs.group()`, then `chrome.tabGroups.update()` with title and color. Stores `{tag → groupId}` in internal map. |
| `switch_tab` | `{tabId}` | `chrome.tabs.update(tabId, {active: true})` + `chrome.windows.update(windowId, {focused: true})` |
| `close_tab` | `{tabId}` | `chrome.tabs.remove(tabId)` |
| `close_group` | `{tag}` | Look up groupId from `tagToGroupId` map (fallback: iterate `chrome.tabGroups.query({})` matching by title). Find all tabs in the group, then `chrome.tabs.remove()` all. Remove entry from map. |

Note: Tab state is maintained via push events (`tabs_updated`). There is no separate request/response `list_tabs` command — the extension pushes the full tab list whenever any tab event occurs.

### content.js Responsibilities

- Listen for `keydown` event on `"/"` key.
- Only trigger when the active element is NOT an input, textarea, or contenteditable element (avoid interfering with typing).
- Call `e.preventDefault()` to suppress the "/" character. **Known limitation:** this will override "/" shortcuts in web apps that use it (e.g., GitHub, YouTube). Accepted trade-off for global search focus.
- Send message to background.js via `chrome.runtime.sendMessage()`.
- background.js forwards `focus_search` event via WebSocket to Python app.

## WebSocket Protocol

Connection endpoint: `ws://localhost:8765/ws/chrome`

All messages are JSON:
```json
{"type": "command_name", "data": {...}}
```

### Python App → Extension (Commands)

```json
// Open tab group
{"type": "open_tab_group", "data": {"tag": "f14", "urls": ["https://...", "https://..."], "color": "blue"}}

// Switch to tab
{"type": "switch_tab", "data": {"tabId": 123}}

// Close tab
{"type": "close_tab", "data": {"tabId": 123}}

// Close entire group
{"type": "close_group", "data": {"tag": "f14"}}
```

### Extension → Python App (Events)

```json
// Tab state changed (pushed on any tab create/remove/activate/move)
{"type": "tabs_updated", "data": {"tabs": [{"id": 1, "url": "...", "title": "...", "groupId": -1, "groupName": ""}]}}
```

For tabs with `groupId !== -1`, the extension resolves the group name by calling `chrome.tabGroups.get(groupId)` and includes it as `groupName` in the tab object.

```json
// User pressed "/" in Chrome
{"type": "focus_search"}

// Connection lifecycle
{"type": "connected"}
{"type": "disconnected"}
```

## Python App Changes

### WebSocket Server

Add a WebSocket endpoint to the existing FastAPI app (same server, port 8765):

```python
# backend/app/routers/websocket.py
@router.websocket("/ws/chrome")
async def chrome_websocket(websocket: WebSocket):
    # Close any existing connection (single-client policy)
    await websocket.accept()
    # Store reference for sending commands
    # Listen for incoming events (tabs_updated, focus_search)
```

### pywebview Focus Handling

When `focus_search` event is received:
1. Bring pywebview window to front using `window.show()` (cross-platform pywebview API). On macOS, additionally use pyobjc `NSApp.activateIgnoringOtherApps_(True)` if `window.show()` alone does not bring focus.
2. Execute JS: `document.querySelector('#search-input').focus()`

**Platform note:** Primary target is macOS. Windows/Linux support is out of scope for now (see YAGNI).

### desktop_app.py Changes

- Store WebSocket connection reference for sending commands to Extension
- Add method to send commands: `send_chrome_command(type, data)`
- Hook into pywebview JS bridge for frontend to call Chrome commands

## Frontend UI Changes

### Chrome Connection Indicator

- Above workspace bar: green dot (connected) or red dot (disconnected)
- Red state shows tooltip: "Chrome Extension not connected"

### Workspace Tag Enhancement

- Each tag chip gets an additional "open in Chrome" icon button
- Click icon → query all bookmarks with that tag → send `open_tab_group` command
- Tag name becomes the Chrome tab group name

### Chrome Tab Panel (new section, sidebar bottom)

- Below bookmark list in sidebar
- Shows current Chrome tab groups and individual tabs
- Each tab: title text, click to `switch_tab`, X button to `close_tab`
- Each group: header with group name, "Close All" button for `close_group`
- Updated in real-time via `tabs_updated` WebSocket events

### "/" Shortcut (in-app)

- When pywebview window has focus, pressing "/" focuses the search input
- Prevents default behavior, same as the Chrome-side "/" handler

## Tab Group Color Assignment

Chrome supports 9 colors: `grey, blue, red, yellow, green, pink, purple, cyan, orange`.

Color is deterministically assigned by hashing the tag name:
```javascript
const colors = ['grey','blue','red','yellow','green','pink','purple','cyan','orange'];
const color = colors[hashCode(tag) % colors.length];
```

## Edge Cases & Error Handling

1. **Extension not installed:** Python app works normally without Chrome integration. Chrome tab panel shows "Extension not connected."
2. **Python app not running:** Extension silently retries connection every 3 seconds. Chrome functions normally.
3. **Multiple Chrome windows:** Only manage tabs in the most recently focused Chrome window. Ignore other windows.
4. **Duplicate tab groups:** If user opens same tag twice, create a new group (don't merge).
5. **Tab closed externally:** Extension detects via `chrome.tabs.onRemoved` listener, sends `tabs_updated` to sync UI.
6. **Extension reloaded/crashed:** `tagToGroupId` map is lost. On reconnect, extension rebuilds the map by querying `chrome.tabGroups.query({})` and matching titles to known tags.
7. **"/" conflicts with web apps:** `preventDefault()` is called, so web apps that use "/" as a shortcut (GitHub, YouTube) will have that shortcut overridden. This is an accepted trade-off.

## Out of Scope (YAGNI)

- Chrome → Python bookmark sync (one-directional control only)
- Tab drag-and-drop reordering
- Extension popup UI (all controls in Python app sidebar)
- Chrome Web Store publishing (dev-mode load unpacked is sufficient)
- Multi-browser support (Chrome only)
- Tab pinning or tab muting controls
- Windows/Linux platform support (macOS only for now)

## Testing Strategy

- **Backend WebSocket:** pytest with Starlette's `TestClient` using `client.websocket_connect("/ws/chrome")` for WebSocket message routing tests
- **Chrome Extension:** Manual testing with Chrome dev tools
- **Integration:** End-to-end manual test: click tag → verify Chrome tabs open → click tab in sidebar → verify Chrome switches
- **"/" hotkey:** Manual test in both Chrome and pywebview contexts

# Playwright Chrome Replacement Design

## Problem

公司政策禁止安裝自製 Chrome Extension，也封鎖了 Chrome DevTools Protocol (remote debugging port)。需要替代方案來控制瀏覽器分頁，保留現有功能。

## Solution

用 Playwright 控制自帶的 Chromium 取代 Chrome Extension + WebSocket 架構。Playwright 不依賴系統 Chrome，不需要 Extension，不需要 debug port。

## Architecture

### Data Flow

```
Frontend (REST) → Backend API → ChromeBrowserManager → Playwright → Chromium
```

之前：
```
Frontend (REST) → Backend API → WebSocket → Chrome Extension → Chrome APIs
```

差異：移除 WebSocket 和 Extension 中間層，backend 直接透過 Playwright API 控制 Chromium。

### Components

#### 1. ChromeBrowserManager (`backend/app/services/chrome_browser.py`)

新增的核心元件，管理 Playwright Chromium 生命週期和分頁操作。

**職責：**
- 啟動/關閉 Playwright Chromium
- 管理 tag → BrowserContext (視窗) 的對應關係
- 每個 tag 開獨立視窗，同 tag 的 URL 在同視窗不同分頁
- 提供分頁操作 API（開、關、切換）
- 回報目前所有分頁狀態

**瀏覽器架構（解決 persistent context 多視窗限制）：**

Playwright 的 `launch_persistent_context()` 只回傳一個 BrowserContext，無法建立多個獨立視窗。因此改用：

- 用 `playwright.chromium.launch()`（非 persistent）啟動 Browser
- 每個 tag 呼叫 `browser.new_context()` 建立獨立 BrowserContext（= 獨立視窗）
- 登入狀態持久化：透過 `context.storage_state()` 手動匯出 cookies/localStorage 到 JSON 檔，下次啟動時用 `browser.new_context(storage_state=path)` 載入
- 儲存路徑：
  - Windows: `%APPDATA%/tibdp/browser-data/storage-state.json`
  - macOS: `~/.tibdp/browser-data/storage-state.json`
- 第一次啟動需手動登入，登入後自動匯出 storage state
- 定期（每 5 分鐘）重新匯出 storage state 以保持最新

**Page ID 方案：**

Playwright Page 沒有穩定的整數 ID（不像 Chrome tab ID）。解決方案：

- ChromeBrowserManager 維護一個 `_page_map: dict[str, Page]`
- 每建立一個 Page，用 `uuid.uuid4().hex[:8]` 產生唯一 ID 作為 key
- `get_tabs()` 回傳的 `id` 欄位用此 UUID string
- 前端 `store.js` 已經將 tabId 當 opaque value 傳遞（`switchChromeTab(existing.id)`），string 型別相容
- Page 關閉時從 `_page_map` 移除，UUID 不重複使用

**主要方法：**
- `start()` — 啟動 Playwright Browser（在獨立 asyncio event loop 線程）
- `stop()` — 關閉所有 context 和 Browser，停止 event loop
- `open_tab_group(tag, urls, focus_url)` — 為 tag 開新 BrowserContext + 多個 Page
- `open_single_tab(url, tag)` — 在已存在的 tag context 開新 Page
- `switch_tab(page_id)` — `page.bring_to_front()` 指定分頁
- `close_tab(page_id)` — 關閉 Page
- `close_group(tag)` — 關閉整個 tag 的 BrowserContext
- `get_tabs()` — 回傳所有分頁資訊（見下方 Response 格式）
- `connected` 屬性 — Browser process 是否在運行

**Thread Safety / Event Loop 設計：**

Playwright async API 必須在啟動它的 event loop 上呼叫。FastAPI (uvicorn) 有自己的 event loop。解決方案：

- ChromeBrowserManager 內部用 `threading.Thread` 跑一個專屬 asyncio event loop
- 所有 Playwright 操作透過 `asyncio.run_coroutine_threadsafe(coro, self._loop)` 排程到這個專屬 loop
- 對外暴露 sync 方法（給 FastAPI route handler 呼叫），內部轉成 async
- `start()` 在 `desktop_app.py` 主流程中呼叫（server 啟動後、pywebview 開啟前）
- 這避免了跨 event loop 呼叫和「no current event loop」錯誤

**Tab Grouping 替代方案：**
- Playwright 沒有原生 Chrome tab group API
- 替代：每個 tag 開獨立 BrowserContext（= 獨立視窗），跟目前行為一致
- 不需要彩色 group 標籤，因為已經是獨立視窗

#### 2. Chrome REST Router (`backend/app/routers/chrome.py`)

重寫自 `websocket.py`，只保留 REST endpoints，改呼叫 ChromeBrowserManager。

**Endpoints（介面不變）：**
- `GET /api/v1/chrome/tabs` — 取得所有分頁 + 連線狀態
- `POST /api/v1/chrome/open-tab-group` — 開 tag group
- `POST /api/v1/chrome/open-single-tab` — 開單一分頁
- `POST /api/v1/chrome/switch-tab` — 切換分頁（tabId 改為 string UUID）
- `POST /api/v1/chrome/close-tab` — 關閉分頁（tabId 改為 string UUID）
- `POST /api/v1/chrome/close-group` — 關閉 tag group

**Request Model 改動：**
- `TabIdRequest.tabId` 型別從 `int` 改為 `str`（UUID string）
- `OpenTabGroupRequest.color` 欄位移除（Playwright 無 tab group color 功能）
- 其他 Request/Response 格式不變

**Response 格式（`GET /chrome/tabs`）：**

回傳的每個 tab 物件保持與前端相容的欄位名：
```json
{
  "id": "a1b2c3d4",
  "url": "https://...",
  "title": "Page Title",
  "groupId": -1,
  "groupName": "tagname",
  "active": true,
  "windowId": 1
}
```
- `id`: UUID string（Playwright Page ID）
- `groupName`: tag 名稱（保持此欄位名，不改為 `tag`，確保 `store.js` 的 `groupOpen` 檢查不變）
- `groupId`: 固定為 -1（無 Chrome tab group 概念）
- `windowId`: BrowserContext 的 UUID（session 內唯一，每次啟動重新產生，僅供前端分組顯示用）
- `active`: 該 context 中最後 `bring_to_front()` 的 page

#### 3. desktop_app.py 改動

**啟動流程（Chromium 在 server 之後、pywebview 之前啟動）：**
1. 啟動 FastAPI server
2. 等待 server ready
3. 啟動 ChromeBrowserManager（Playwright Chromium，非同步在專屬線程）
4. 註冊全域快捷鍵 `Ctrl+Shift+F`（pynput）
5. 開啟 pywebview menubar 視窗（左 10%）

Chromium 在 pywebview 開啟前啟動，避免使用者點擊書籤時 browser 還沒 ready。前端的 `chromeConnected` 狀態會在 Chromium ready 後透過 polling 自動更新。

**全域快捷鍵：**
- `Ctrl+Shift+F` → focus pywebview 視窗 + focus 搜尋框
- 用 `pynput.keyboard.GlobalHotKeys` 監聽
- 取代之前 content.js 的 `/` hotkey
- 優勢：任何程式都能觸發，不限於瀏覽器
- 限制（Windows）：當前景視窗是以系統管理員權限執行時（如工作管理員），pynput 的 `SetWindowsHookEx` 會被系統封鎖，快捷鍵不會觸發。這是 Windows 安全機制限制，無法避免。大多數日常使用不受影響。

**Chromium 視窗定位：**
- 右 90% 螢幕
- Windows 用 `ctypes.windll.user32.GetSystemMetrics` 取得螢幕解析度

**關閉流程：**
- 使用者關 menubar → on_closed → ChromeBrowserManager.stop() → 關所有 Chromium 視窗 → 停 server

## Files Changed

### 移除
- `chrome-extension/` 整個資料夾（manifest.json, background.js, content.js）
- `backend/app/routers/websocket.py`（整個檔案）
- `requirements.txt` 的 `websockets` 套件
- `main.py` 的 `ws_router` 掛載

### 新增
- `backend/app/services/chrome_browser.py` — ChromeBrowserManager
- `backend/app/routers/chrome.py` — REST endpoints（從 websocket.py 的 rest_router 遷移）

### 修改
- `backend/app/main.py` — 移除 ws_router，掛載新的 chrome_router
- `desktop_app.py` — Playwright 啟動（server ready 後、pywebview 前） + pynput 全域快捷鍵 + Windows 螢幕偵測
- `requirements.txt` — 加 `playwright`, `pynput`；移除 `websockets`
- `frontend/js/store.js` — `TabIdRequest` 的 `tabId` 從 int 改為 string（影響 `switchChromeTab` 和 `closeChromeTab`，但因為 JS 本來就不區分 int/string 在 JSON 傳遞中，實際上不需要改 code，只是值從數字變成字串）

### 不變
- `frontend/js/components/chrome-tabs.js` — 2s polling 不變
- `frontend/index.html`, `frontend/css/` — 不變

## Error Handling

- **Chromium 啟動失敗：** REST API 回傳 `{ success: false, message: "Browser not running" }`，前端顯示斷線
- **Chromium 被手動關掉：** ChromeBrowserManager 監聯 `browser.on("disconnected")` 事件，自動重新啟動 Browser。重啟時載入先前匯出的 `storage-state.json` 恢復登入狀態。設有 backoff 機制：連續重啟失敗 3 次後停止嘗試，將 `connected` 設為 `false`，等待使用者手動操作（或下次 REST 呼叫時重試）。
- **分頁/視窗被手動關掉：** 監聽 `page.on("close")` 和 `context.on("close")`，從 `_page_map` 和 `_tag_contexts` 清除。`get_tabs()` 總是回傳最新狀態。
- **Storage state 損壞：** 若 `storage-state.json` 無法解析，刪除該檔並以空白 state 啟動（使用者需重新登入）。不會刪除整個 browser-data 資料夾。
- **Stale page ID：** 前端 2s polling 可能持有已關閉 Page 的 ID。`switch_tab` / `close_tab` 收到不存在的 page_id 時回傳 `{ success: false, message: "Tab not found" }`，前端下次 poll 會自動修正。

## Testing

- **單元測試：** ChromeBrowserManager 的 tab/window 管理邏輯（mock Playwright）
- **整合測試：** REST API → ChromeBrowserManager（真實 Playwright headless Chromium）
- **E2E 測試：** 保留現有 Playwright E2E，調整 chrome status 相關部分
- **全域快捷鍵：** 手動測試（pynput 全域監聽不易自動化）

## Dependencies

新增：
- `playwright` — Chromium 控制
- `pynput` — 全域快捷鍵監聽

移除：
- `websockets` — 不再需要 WebSocket

安裝流程：
```bash
pip install playwright pynput
playwright install chromium
```

`desktop_app.py` 啟動時會檢查 Chromium binary 是否存在，若不存在則自動執行 `playwright install chromium`（或顯示錯誤提示要求使用者手動執行）。

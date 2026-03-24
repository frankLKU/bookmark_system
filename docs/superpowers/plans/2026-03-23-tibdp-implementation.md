# TIBDP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a centralized bookmark management portal for TSMC engineers with sidebar navigation, iframe tab management, factory workspace filtering, and OneTab import.

**Architecture:** FastAPI backend with SQLite serves a pure HTML/CSS/JS frontend as static files. Backend provides RESTful API at `/api/v1/` for bookmark/category CRUD, OneTab import/export, health checks, and an iframe proxy. Frontend uses vanilla JS pub/sub state management with CSS Variables for theming.

**Tech Stack:** Python FastAPI, SQLite (stdlib sqlite3), Pydantic, httpx, pytest | HTML5, CSS3, Vanilla JavaScript

**Spec:** `docs/superpowers/specs/2026-03-23-tibdp-implementation-design.md`

---

## File Map

### Backend — New Files
- `backend/app/database.py` — SQLite connection manager (generator dependency), table creation
- `backend/app/routers/health.py` — Health check endpoints (POST trigger, GET status)

### Backend — Rewrite Files (existing stubs → full implementation)
- `backend/app/models.py` — Rewrite Pydantic models to match spec (UUID ids, tags, is_combined, etc.)
- `backend/app/routers/bookmarks.py` — Rewrite with SQLite integration
- `backend/app/routers/categories.py` — Rewrite with SQLite integration
- `backend/app/routers/import_export.py` — Rewrite with two-step import + export
- `backend/app/routers/proxy.py` — Rewrite with httpx proxy + login detection
- `backend/app/main.py` — Add routers incrementally, StaticFiles mount, startup event for DB init

### Test Files — Rewrite
- `tests/tibdp/backend/conftest.py` — Add in-memory SQLite fixture, DB setup/teardown
- `tests/tibdp/backend/test_database.py` — New: DB initialization tests
- `tests/tibdp/backend/test_models_validation.py` — Update for new model fields
- `tests/tibdp/backend/test_api_bookmarks.py` — Full CRUD with real DB assertions
- `tests/tibdp/backend/test_api_categories.py` — Full CRUD with real DB assertions
- `tests/tibdp/backend/test_api_import_export.py` — Two-step import flow tests
- `tests/tibdp/backend/test_api_health.py` — New file
- `tests/tibdp/backend/test_api_proxy.py` — New file

### Frontend — All New
- `frontend/index.html`
- `frontend/css/variables.css`, `layout.css`, `components.css`, `utilities.css`
- `frontend/js/app.js`, `api.js`, `store.js`, `router.js`
- `frontend/js/components/workspace-bar.js`, `sidebar.js`, `tab-bar.js`, `smart-iframe.js`, `split-view.js`, `modals.js`
- `frontend/js/utils/fuzzy-search.js`, `onetab-parser.js`, `keyboard-nav.js`, `theme.js`

### Cleanup Files
- Delete: `frontend/node_modules/`, `frontend/src/`, `frontend/dist/`, `frontend/public/`, `frontend/.vercel/`
- Delete: `frontend/vite.config.ts`, `frontend/vitest.config.ts`, `frontend/eslint.config.js`
- Delete: `frontend/package.json`, `frontend/package-lock.json`, `frontend/bun.lock`
- Delete: `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`
- Delete: `frontend/README.md`, `frontend/index.html` (old React entry)
- Delete: `tests/tibdp/frontend/*.test.ts` (stale TypeScript tests)
- Create: `docs/designs/api-tibdp.md` — API interface doc (per CLAUDE.md workflow rule)
- Modify: `CLAUDE.md` — change `"code"` to `"success"` in API format
- Modify: `docs/prd/tibdp.md` — remove Zustand refs, update NFR-4, update Section 8
- Modify: `docs/designs/tibdp.md` — remove React/Zustand/Tailwind refs

---

## Phase 1: Cleanup (Team Lead)

### Task 1: Delete stale frontend artifacts and framework files

**Files:**
- Delete: `frontend/node_modules/`, `frontend/src/`, `frontend/dist/`, `frontend/public/`, `frontend/.vercel/`
- Delete: `frontend/vite.config.ts`, `frontend/vitest.config.ts`, `frontend/eslint.config.js`
- Delete: `frontend/package.json`, `frontend/package-lock.json`, `frontend/bun.lock`
- Delete: `frontend/tsconfig.json`, `frontend/tsconfig.app.json`, `frontend/tsconfig.node.json`
- Delete: `frontend/README.md`, `frontend/index.html` (old React entry point)
- Delete: `tests/tibdp/frontend/*.test.ts`

- [ ] **Step 1: Delete all framework artifacts from frontend/**

```bash
rm -rf frontend/node_modules frontend/src frontend/dist frontend/public frontend/.vercel
rm -f frontend/vite.config.ts frontend/vitest.config.ts frontend/eslint.config.js
rm -f frontend/package.json frontend/package-lock.json frontend/bun.lock
rm -f frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.node.json
rm -f frontend/README.md frontend/index.html
```

- [ ] **Step 2: Delete stale TypeScript test files**

```bash
rm -f tests/tibdp/frontend/bookmark-store.test.ts
rm -f tests/tibdp/frontend/fuzzy-search.test.ts
rm -f tests/tibdp/frontend/onetab-parser.test.ts
rm -f tests/tibdp/frontend/tab-store.test.ts
```

- [ ] **Step 3: Verify cleanup**

```bash
ls frontend/
ls tests/tibdp/frontend/
```

Expected: `frontend/` has only `.gitignore` (or is empty). `tests/tibdp/frontend/` is empty.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/ tests/tibdp/frontend/
git commit -m "chore: remove all React/Vite/TypeScript framework artifacts"
```

---

### Task 2: Update CLAUDE.md API response format

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Change `"code"` to `"success"` in API 介面規範 section**

Find this line in CLAUDE.md:
```
- 回傳格式：`{ "data": ..., "message": "...", "code": true/false }`
```

Replace with:
```
- 回傳格式：`{ "data": ..., "message": "...", "success": true/false }`
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update API response format to use 'success' instead of 'code'"
```

---

### Task 3: Update PRD to match current architecture

**Files:**
- Modify: `docs/prd/tibdp.md`

- [ ] **Step 1: Update Section 2 Technical Stack table**

Replace the table to remove Zustand:
```markdown
| Layer | Technology |
|-------|-----------|
| Frontend | 純 HTML5 + CSS3 + Vanilla JavaScript（無框架、無 build tool） |
| Styling | 原生 CSS（CSS Variables 支援 dark/light mode） |
| State Management | JavaScript 物件 + Pub/Sub pattern |
| Icons | SVG inline |
| Data Persistence | SQLite（透過 Backend API 存取） |
| Backend | Python FastAPI（serve API + 靜態前端檔案） |
| Database | SQLite |
```

- [ ] **Step 2: Update FR-4.6.5**

Change:
```
- FR-4.6.5: Persist all data to browser storage (LocalStorage or IndexedDB) via Zustand persistence middleware
```
To:
```
- FR-4.6.5: Persist all data to SQLite database via Backend API
```

- [ ] **Step 3: Update Section 6 Priority table**

Replace `Zustand bookmark store with persistence` with `SQLite database + Backend API`.

- [ ] **Step 4: Update NFR-4**

Change:
```
| NFR-4 | No backend server required for MVP; all data is client-side |
```
To:
```
| NFR-4 | Single Python backend service (FastAPI + SQLite); no external database dependency |
```

- [ ] **Step 5: Update Section 8 API Interface Notes**

Replace the entire section with:
```markdown
## 8. API Interface Notes

Backend provides RESTful API for all data operations:
- Prefix: `/api/v1/`
- Response format: `{ "data": ..., "message": "...", "success": true/false }`
- Full API specification: see `docs/superpowers/specs/2026-03-23-tibdp-implementation-design.md`
```

- [ ] **Step 6: Commit**

```bash
git add docs/prd/tibdp.md
git commit -m "docs: update PRD to reflect FastAPI + SQLite architecture"
```

---

### Task 4: Update design doc to remove framework references

**Files:**
- Modify: `docs/designs/tibdp.md`

- [ ] **Step 1: Update Section 7 header and content**

Replace "State Management (Zustand Store)" header with "State Management (Vanilla JS)".

Replace all `useBookmarkStore`, `useTabStore`, `useUIStore` Zustand store descriptions with equivalent vanilla JS store descriptions:

```markdown
## 7. State Management (Vanilla JS)

The application uses a pub/sub pattern in `store.js` for state management:

### BookmarkStore
- `bookmarks: []` - all bookmarks
- `categories: []` - all categories
- `activeWorkspace: null` - current factory filter (null = all)
- `searchQuery: ''` - current search text
- `getFilteredBookmarks()` - derived: filtered by workspace + search
- CRUD methods via API calls: `addBookmark`, `updateBookmark`, `deleteBookmark`, `addCategory`, `updateCategory`, `deleteCategory`, `reorderCategories`
- `importBookmarks(parsed)` - bulk import via API
- `exportToJSON()` - triggers export API download

### TabStore
- `tabs: []` - open tabs
- `activeTabId: null` - currently visible tab
- `openTab(url, title)` - opens or focuses existing tab
- `closeTab(id)` - closes a tab
- `openCombinedTab(url1, url2, title)` - opens split view tab
- `exitCombinedView(tabId)` - converts split tab back to single

### UIStore
- `theme: 'system'` - 'light' | 'dark' | 'system'
- `collapsedCategories: []` - which categories are collapsed
- `keyboardNavIndex: -1` - current keyboard navigation position
```

- [ ] **Step 2: Update Section 9 Dark/Light Mode**

Replace Tailwind `dark:` references:
```markdown
## 9. Dark/Light Mode

- Follows `prefers-color-scheme` media query by default
- User can override via settings toggle in sidebar footer
- Uses CSS Variables on `<html data-theme="dark|light">` for theming
- Theme preference stored in localStorage
```

- [ ] **Step 3: Remove Tailwind class references from component specs**

Throughout sections 2-6, replace Tailwind utility classes with descriptive CSS notes. For example:
- `bg-gray-900` → "dark background (#111827)"
- `text-sm` → "14px font size"
- `h-10` → "height: 40px"
- `px-3 py-2` → "padding: 8px 12px"
- `rounded-md` → "border-radius: 6px"
- `gap-1` → "gap: 4px"

Keep the color values as reference but note they'll be CSS Variables.

- [ ] **Step 4: Commit**

```bash
git add docs/designs/tibdp.md
git commit -m "docs: update design doc to remove React/Zustand/Tailwind references"
```

---

### Task 5: Create API interface document

**Files:**
- Create: `docs/designs/api-tibdp.md`

Per CLAUDE.md rule: "Frontend 與 Backend 在開始實作前，必須先在 `docs/designs/api-[功能名稱].md` 中確認 API 介面"

- [ ] **Step 1: Create api-tibdp.md**

Extract API endpoint details from the implementation spec into `docs/designs/api-tibdp.md`. Include all endpoints, request/response schemas, and the proxy behavior. This is the contract document that Frontend and Backend agents share.

- [ ] **Step 2: Commit**

```bash
git add docs/designs/api-tibdp.md
git commit -m "docs: create API interface document for TIBDP"
```

---

## Phase 2: Backend (Backend Agent)

### Task 6: Create SQLite database layer

**Files:**
- Create: `backend/app/database.py`
- Test: `tests/tibdp/backend/test_database.py` (new)

- [ ] **Step 1: Write failing test for database initialization**

Create `tests/tibdp/backend/test_database.py`:

```python
import sqlite3
import pytest
from app.database import get_db, init_db, DB_PATH


class TestInitDb:
    def test_creates_bookmarks_table(self, tmp_path):
        db_path = tmp_path / "test.db"
        init_db(str(db_path))
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='bookmarks'")
        assert cursor.fetchone() is not None
        conn.close()

    def test_creates_categories_table(self, tmp_path):
        db_path = tmp_path / "test.db"
        init_db(str(db_path))
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'")
        assert cursor.fetchone() is not None
        conn.close()

    def test_creates_health_checks_table(self, tmp_path):
        db_path = tmp_path / "test.db"
        init_db(str(db_path))
        conn = sqlite3.connect(str(db_path))
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='health_checks'")
        assert cursor.fetchone() is not None
        conn.close()

    def test_idempotent_init(self, tmp_path):
        db_path = tmp_path / "test.db"
        init_db(str(db_path))
        init_db(str(db_path))  # should not raise
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_database.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.database'`

- [ ] **Step 3: Implement database.py**

Create `backend/app/database.py`:

```python
import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "bookmarks.db")


def init_db(db_path: str = DB_PATH):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            display_order INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS bookmarks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
            tags TEXT DEFAULT '[]',
            is_combined INTEGER DEFAULT 0,
            last_accessed INTEGER,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS health_checks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bookmark_id TEXT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
            is_healthy INTEGER NOT NULL,
            status_code INTEGER NOT NULL,
            checked_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category_id);
        CREATE INDEX IF NOT EXISTS idx_health_bookmark ON health_checks(bookmark_id);
    """)
    conn.commit()
    conn.close()


def get_db(db_path: str = DB_PATH):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
    finally:
        conn.close()
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_database.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/database.py tests/tibdp/backend/test_database.py
git commit -m "feat: add SQLite database layer with schema initialization"
```

---

### Task 6: Rewrite Pydantic models

**Files:**
- Rewrite: `backend/app/models.py`
- Rewrite: `tests/tibdp/backend/test_models_validation.py`

- [ ] **Step 1: Write updated model validation tests**

Rewrite `tests/tibdp/backend/test_models_validation.py`:

```python
import pytest
from pydantic import ValidationError
from app.models import (
    BookmarkCreate, BookmarkUpdate, BookmarkResponse,
    CategoryCreate, CategoryUpdate,
    ImportOnetabRequest, ImportConfirmRequest, ImportConfirmBookmark,
)


class TestBookmarkCreate:
    def test_valid_minimal(self):
        b = BookmarkCreate(title="Spark F18", url="https://spark-f18.tsmc.com")
        assert b.title == "Spark F18"
        assert b.tags == []
        assert b.is_combined is False

    def test_valid_full(self):
        b = BookmarkCreate(
            title="Spark F18",
            url="https://spark-f18.tsmc.com",
            category_id="cat-uuid",
            tags=["f18", "f14a"],
            is_combined=True,
        )
        assert b.tags == ["f18", "f14a"]
        assert b.is_combined is True

    def test_missing_title_raises(self):
        with pytest.raises(ValidationError):
            BookmarkCreate(url="https://spark.com")

    def test_missing_url_raises(self):
        with pytest.raises(ValidationError):
            BookmarkCreate(title="Spark")


class TestBookmarkUpdate:
    def test_all_optional(self):
        b = BookmarkUpdate()
        assert b.title is None
        assert b.tags is None

    def test_partial(self):
        b = BookmarkUpdate(title="New", tags=["f18"])
        assert b.title == "New"
        assert b.tags == ["f18"]


class TestCategoryCreate:
    def test_valid(self):
        c = CategoryCreate(name="Monitoring")
        assert c.name == "Monitoring"

    def test_missing_name_raises(self):
        with pytest.raises(ValidationError):
            CategoryCreate()


class TestImportOnetabRequest:
    def test_valid(self):
        r = ImportOnetabRequest(content="https://spark.com | Spark")
        assert r.content == "https://spark.com | Spark"

    def test_missing_content_raises(self):
        with pytest.raises(ValidationError):
            ImportOnetabRequest()


class TestImportConfirmRequest:
    def test_valid(self):
        r = ImportConfirmRequest(bookmarks=[
            ImportConfirmBookmark(title="Spark", url="https://spark.com", tags=["f18"], category="Spark")
        ])
        assert len(r.bookmarks) == 1
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_models_validation.py -v
```

Expected: FAIL — `ImportError: cannot import name 'ImportOnetabRequest'`

- [ ] **Step 3: Rewrite models.py**

Rewrite `backend/app/models.py`:

```python
from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime


# --- Bookmarks ---

class BookmarkCreate(BaseModel):
    title: str
    url: str
    category_id: Optional[str] = None
    tags: list[str] = []
    is_combined: bool = False

class BookmarkUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    category_id: Optional[str] = None
    tags: Optional[list[str]] = None
    is_combined: Optional[bool] = None

class BookmarkResponse(BaseModel):
    id: str
    title: str
    url: str
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    tags: list[str] = []
    is_combined: bool = False
    last_accessed: Optional[int] = None
    created_at: str
    updated_at: str

class PaginatedBookmarks(BaseModel):
    items: list[BookmarkResponse]
    total: int
    page: int
    per_page: int


# --- Categories ---

class CategoryCreate(BaseModel):
    name: str

class CategoryUpdate(BaseModel):
    name: Optional[str] = None

class CategoryReorder(BaseModel):
    order: list[str]  # list of category IDs in desired order

class CategoryResponse(BaseModel):
    id: str
    name: str
    display_order: int = 0
    bookmark_count: int = 0
    created_at: str
    updated_at: str


# --- Import / Export ---

class ImportOnetabRequest(BaseModel):
    content: str

class ImportPreviewItem(BaseModel):
    temp_id: int
    title: str
    url: str
    tags: list[str] = []
    category: str = ""

class ImportConfirmBookmark(BaseModel):
    title: str
    url: str
    tags: list[str] = []
    category: str = ""

class ImportConfirmRequest(BaseModel):
    bookmarks: list[ImportConfirmBookmark]

class ExportCategory(BaseModel):
    id: str
    name: str
    bookmarks: list[BookmarkResponse]

class ExportResponse(BaseModel):
    exported_at: str
    total: int
    categories: list[ExportCategory]


# --- Health ---

class HealthStatusItem(BaseModel):
    bookmark_id: str
    is_healthy: bool
    status_code: int
    checked_at: str


# --- Common ---

class APIResponse(BaseModel):
    data: Any = None
    message: str = ""
    success: bool = True
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_models_validation.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models.py tests/tibdp/backend/test_models_validation.py
git commit -m "feat: rewrite Pydantic models to match TIBDP spec (UUID ids, tags, import schemas)"
```

---

### Task 7: Implement Bookmarks CRUD API

**Files:**
- Rewrite: `backend/app/routers/bookmarks.py`
- Rewrite: `tests/tibdp/backend/test_api_bookmarks.py`
- Modify: `tests/tibdp/backend/conftest.py`

- [ ] **Step 1: Update conftest.py with DB fixture**

Rewrite `tests/tibdp/backend/conftest.py`:

```python
import pytest
import sqlite3
from fastapi.testclient import TestClient
from app.database import init_db, get_db
from app.main import app


@pytest.fixture(autouse=True)
def test_db(tmp_path):
    db_path = str(tmp_path / "test.db")
    init_db(db_path)
    def override_get_db():
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
        finally:
            conn.close()
    app.dependency_overrides[get_db] = override_get_db
    yield db_path
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def seed_category(client):
    resp = client.post("/api/v1/categories", json={"name": "Spark"})
    return resp.json()["data"]["id"]


@pytest.fixture
def seed_bookmark(client, seed_category):
    resp = client.post("/api/v1/bookmarks", json={
        "title": "Spark F18",
        "url": "https://spark-f18.tsmc.com",
        "category_id": seed_category,
        "tags": ["f18"],
    })
    return resp.json()["data"]["id"]
```

- [ ] **Step 2: Write bookmark API tests**

Rewrite `tests/tibdp/backend/test_api_bookmarks.py`:

```python
class TestListBookmarks:
    def test_empty_list(self, client):
        resp = client.get("/api/v1/bookmarks")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["items"] == []
        assert data["data"]["total"] == 0

    def test_with_data(self, client, seed_bookmark):
        resp = client.get("/api/v1/bookmarks")
        assert resp.json()["data"]["total"] == 1
        assert resp.json()["data"]["items"][0]["title"] == "Spark F18"

    def test_pagination(self, client):
        resp = client.get("/api/v1/bookmarks?page=1&per_page=5")
        assert resp.json()["data"]["page"] == 1
        assert resp.json()["data"]["per_page"] == 5

    def test_search_filter(self, client, seed_bookmark):
        resp = client.get("/api/v1/bookmarks?search=spark")
        assert resp.json()["data"]["total"] == 1

    def test_search_no_match(self, client, seed_bookmark):
        resp = client.get("/api/v1/bookmarks?search=grafana")
        assert resp.json()["data"]["total"] == 0

    def test_tag_filter(self, client, seed_bookmark):
        resp = client.get("/api/v1/bookmarks?tag=f18")
        assert resp.json()["data"]["total"] == 1

    def test_tag_no_match(self, client, seed_bookmark):
        resp = client.get("/api/v1/bookmarks?tag=f12")
        assert resp.json()["data"]["total"] == 0

    def test_category_filter(self, client, seed_bookmark, seed_category):
        resp = client.get(f"/api/v1/bookmarks?category_id={seed_category}")
        assert resp.json()["data"]["total"] == 1

    def test_includes_category_name(self, client, seed_bookmark):
        resp = client.get("/api/v1/bookmarks")
        item = resp.json()["data"]["items"][0]
        assert item["category_name"] == "Spark"


class TestGetBookmark:
    def test_get_existing(self, client, seed_bookmark):
        resp = client.get(f"/api/v1/bookmarks/{seed_bookmark}")
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == seed_bookmark

    def test_get_nonexistent(self, client):
        resp = client.get("/api/v1/bookmarks/nonexistent-id")
        assert resp.status_code == 404


class TestCreateBookmark:
    def test_create_minimal(self, client):
        resp = client.post("/api/v1/bookmarks", json={
            "title": "Test", "url": "https://test.com"
        })
        assert resp.status_code == 201
        assert resp.json()["data"]["id"] is not None
        assert resp.json()["data"]["tags"] == []

    def test_create_with_tags(self, client):
        resp = client.post("/api/v1/bookmarks", json={
            "title": "Test", "url": "https://test.com", "tags": ["f18", "f14a"]
        })
        assert resp.json()["data"]["tags"] == ["f18", "f14a"]

    def test_create_missing_title(self, client):
        resp = client.post("/api/v1/bookmarks", json={"url": "https://test.com"})
        assert resp.status_code == 422


class TestUpdateBookmark:
    def test_update_title(self, client, seed_bookmark):
        resp = client.put(f"/api/v1/bookmarks/{seed_bookmark}", json={"title": "Updated"})
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "Updated"

    def test_update_nonexistent(self, client):
        resp = client.put("/api/v1/bookmarks/fake-id", json={"title": "X"})
        assert resp.status_code == 404


class TestDeleteBookmark:
    def test_delete_existing(self, client, seed_bookmark):
        resp = client.delete(f"/api/v1/bookmarks/{seed_bookmark}")
        assert resp.status_code == 200
        # verify gone
        resp2 = client.get(f"/api/v1/bookmarks/{seed_bookmark}")
        assert resp2.status_code == 404

    def test_delete_nonexistent(self, client):
        resp = client.delete("/api/v1/bookmarks/fake-id")
        assert resp.status_code == 404


class TestUpdateAccess:
    def test_update_last_accessed(self, client, seed_bookmark):
        resp = client.patch(f"/api/v1/bookmarks/{seed_bookmark}/access")
        assert resp.status_code == 200
        assert resp.json()["data"]["last_accessed"] is not None
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_api_bookmarks.py -v
```

Expected: FAIL — routes return stubs, no DB integration.

- [ ] **Step 4: Implement bookmarks router**

Rewrite `backend/app/routers/bookmarks.py` with full SQLite CRUD:

```python
import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Query, HTTPException, Depends
from typing import Optional

from app.models import BookmarkCreate, BookmarkUpdate
from app.database import get_db

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("/bookmarks")
def list_bookmarks(
    category_id: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db=Depends(get_db),
):
    conditions = []
    params = []

    if category_id:
        conditions.append("b.category_id = ?")
        params.append(category_id)
    if tag:
        conditions.append("b.tags LIKE ?")
        params.append(f'%"{tag}"%')
    if search:
        conditions.append("(b.title LIKE ? OR b.url LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])

    where = "WHERE " + " AND ".join(conditions) if conditions else ""
    offset = (page - 1) * per_page

    count_sql = f"SELECT COUNT(*) FROM bookmarks b {where}"
    total = db.execute(count_sql, params).fetchone()[0]

    sql = f"""
        SELECT b.*, c.name as category_name
        FROM bookmarks b
        LEFT JOIN categories c ON b.category_id = c.id
        {where}
        ORDER BY CASE WHEN b.last_accessed IS NULL THEN 1 ELSE 0 END, b.last_accessed DESC, b.created_at DESC
        LIMIT ? OFFSET ?
    """
    rows = db.execute(sql, params + [per_page, offset]).fetchall()

    items = []
    for r in rows:
        items.append({
            "id": r["id"], "title": r["title"], "url": r["url"],
            "category_id": r["category_id"], "category_name": r["category_name"],
            "tags": json.loads(r["tags"]), "is_combined": bool(r["is_combined"]),
            "last_accessed": r["last_accessed"],
            "created_at": r["created_at"], "updated_at": r["updated_at"],
        })

    return {
        "data": {"items": items, "total": total, "page": page, "per_page": per_page},
        "message": "Bookmarks retrieved successfully",
        "success": True,
    }


@router.get("/bookmarks/{bookmark_id}")
def get_bookmark(bookmark_id: str, db=Depends(get_db)):
    row = db.execute(
        "SELECT b.*, c.name as category_name FROM bookmarks b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?",
        (bookmark_id,)
    ).fetchone()
    db.close()
    if not row:
        raise HTTPException(404, detail="Bookmark not found")
    return {
        "data": {
            "id": row["id"], "title": row["title"], "url": row["url"],
            "category_id": row["category_id"], "category_name": row["category_name"],
            "tags": json.loads(row["tags"]), "is_combined": bool(row["is_combined"]),
            "last_accessed": row["last_accessed"],
            "created_at": row["created_at"], "updated_at": row["updated_at"],
        },
        "message": "Bookmark retrieved", "success": True,
    }


@router.post("/bookmarks", status_code=201)
def create_bookmark(bookmark: BookmarkCreate, db=Depends(get_db)):
    bid = str(uuid.uuid4())
    now = _now()
    db.execute(
        "INSERT INTO bookmarks (id, title, url, category_id, tags, is_combined, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (bid, bookmark.title, bookmark.url, bookmark.category_id, json.dumps(bookmark.tags), int(bookmark.is_combined), now, now),
    )
    db.commit()
    row = db.execute(
        "SELECT b.*, c.name as category_name FROM bookmarks b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?",
        (bid,)
    ).fetchone()
    return {
        "data": {
            "id": row["id"], "title": row["title"], "url": row["url"],
            "category_id": row["category_id"], "category_name": row["category_name"],
            "tags": json.loads(row["tags"]), "is_combined": bool(row["is_combined"]),
            "last_accessed": row["last_accessed"],
            "created_at": row["created_at"], "updated_at": row["updated_at"],
        },
        "message": "Bookmark created successfully", "success": True,
    }


@router.put("/bookmarks/{bookmark_id}")
def update_bookmark(bookmark_id: str, bookmark: BookmarkUpdate, db=Depends(get_db)):
    existing = db.execute("SELECT id FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
    if not existing:
        raise HTTPException(404, detail="Bookmark not found")

    updates = []
    params = []
    if bookmark.title is not None:
        updates.append("title = ?"); params.append(bookmark.title)
    if bookmark.url is not None:
        updates.append("url = ?"); params.append(bookmark.url)
    if bookmark.category_id is not None:
        updates.append("category_id = ?"); params.append(bookmark.category_id)
    if bookmark.tags is not None:
        updates.append("tags = ?"); params.append(json.dumps(bookmark.tags))
    if bookmark.is_combined is not None:
        updates.append("is_combined = ?"); params.append(int(bookmark.is_combined))

    if updates:
        updates.append("updated_at = ?"); params.append(_now())
        params.append(bookmark_id)
        db.execute(f"UPDATE bookmarks SET {', '.join(updates)} WHERE id = ?", params)
        db.commit()

    row = db.execute(
        "SELECT b.*, c.name as category_name FROM bookmarks b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?",
        (bookmark_id,)
    ).fetchone()
    return {
        "data": {
            "id": row["id"], "title": row["title"], "url": row["url"],
            "category_id": row["category_id"], "category_name": row["category_name"],
            "tags": json.loads(row["tags"]), "is_combined": bool(row["is_combined"]),
            "last_accessed": row["last_accessed"],
            "created_at": row["created_at"], "updated_at": row["updated_at"],
        },
        "message": "Bookmark updated successfully", "success": True,
    }


@router.delete("/bookmarks/{bookmark_id}")
def delete_bookmark(bookmark_id: str, db=Depends(get_db)):
    existing = db.execute("SELECT id FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
    if not existing:
        raise HTTPException(404, detail="Bookmark not found")
    db.execute("DELETE FROM bookmarks WHERE id = ?", (bookmark_id,))
    db.commit()
    return {"data": None, "message": "Bookmark deleted successfully", "success": True}


@router.patch("/bookmarks/{bookmark_id}/access")
def update_access(bookmark_id: str, db=Depends(get_db)):
    existing = db.execute("SELECT id FROM bookmarks WHERE id = ?", (bookmark_id,)).fetchone()
    if not existing:
        raise HTTPException(404, detail="Bookmark not found")
    import time
    now_ts = int(time.time())
    db.execute("UPDATE bookmarks SET last_accessed = ?, updated_at = ? WHERE id = ?", (now_ts, _now(), bookmark_id))
    db.commit()
    row = db.execute(
        "SELECT b.*, c.name as category_name FROM bookmarks b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?",
        (bookmark_id,)
    ).fetchone()
    return {
        "data": {
            "id": row["id"], "title": row["title"], "url": row["url"],
            "category_id": row["category_id"], "category_name": row["category_name"],
            "tags": json.loads(row["tags"]), "is_combined": bool(row["is_combined"]),
            "last_accessed": row["last_accessed"],
            "created_at": row["created_at"], "updated_at": row["updated_at"],
        },
        "message": "Access updated", "success": True,
    }
```

- [ ] **Step 5: Update main.py to use DB dependency injection**

Update `backend/app/main.py` to add `get_db` as a dependency and add startup event:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import init_db
from app.routers import bookmarks, categories, import_export


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="Bookmark System API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bookmarks.router, prefix="/api/v1", tags=["bookmarks"])
app.include_router(categories.router, prefix="/api/v1", tags=["categories"])
app.include_router(import_export.router, prefix="/api/v1", tags=["import_export"])
# Note: health and proxy routers will be added in Tasks 11 and 12 respectively


@app.get("/")
def root():
    return {"message": "Bookmark System API"}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_api_bookmarks.py -v
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/bookmarks.py backend/app/main.py tests/tibdp/backend/conftest.py tests/tibdp/backend/test_api_bookmarks.py
git commit -m "feat: implement bookmarks CRUD API with SQLite"
```

---

### Task 8: Implement Categories CRUD API

**Files:**
- Rewrite: `backend/app/routers/categories.py`
- Rewrite: `tests/tibdp/backend/test_api_categories.py`

- [ ] **Step 1: Write category API tests**

Rewrite `tests/tibdp/backend/test_api_categories.py`:

```python
class TestListCategories:
    def test_empty_list(self, client):
        resp = client.get("/api/v1/categories")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_with_data(self, client, seed_category):
        resp = client.get("/api/v1/categories")
        assert len(resp.json()["data"]) == 1
        assert resp.json()["data"][0]["name"] == "Spark"

    def test_includes_bookmark_count(self, client, seed_bookmark):
        resp = client.get("/api/v1/categories")
        assert resp.json()["data"][0]["bookmark_count"] == 1


class TestCreateCategory:
    def test_create(self, client):
        resp = client.post("/api/v1/categories", json={"name": "Monitoring"})
        assert resp.status_code == 201
        assert resp.json()["data"]["name"] == "Monitoring"

    def test_duplicate_name(self, client, seed_category):
        resp = client.post("/api/v1/categories", json={"name": "Spark"})
        assert resp.status_code == 409

    def test_missing_name(self, client):
        resp = client.post("/api/v1/categories", json={})
        assert resp.status_code == 422


class TestUpdateCategory:
    def test_rename(self, client, seed_category):
        resp = client.put(f"/api/v1/categories/{seed_category}", json={"name": "Renamed"})
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "Renamed"

    def test_nonexistent(self, client):
        resp = client.put("/api/v1/categories/fake-id", json={"name": "X"})
        assert resp.status_code == 404


class TestDeleteCategory:
    def test_delete(self, client, seed_category):
        resp = client.delete(f"/api/v1/categories/{seed_category}")
        assert resp.status_code == 200

    def test_bookmarks_become_uncategorized(self, client, seed_bookmark, seed_category):
        client.delete(f"/api/v1/categories/{seed_category}")
        resp = client.get(f"/api/v1/bookmarks/{seed_bookmark}")
        assert resp.json()["data"]["category_id"] is None

    def test_nonexistent(self, client):
        resp = client.delete("/api/v1/categories/fake-id")
        assert resp.status_code == 404


class TestReorderCategories:
    def test_reorder(self, client):
        r1 = client.post("/api/v1/categories", json={"name": "A"})
        r2 = client.post("/api/v1/categories", json={"name": "B"})
        id_a = r1.json()["data"]["id"]
        id_b = r2.json()["data"]["id"]
        resp = client.put("/api/v1/categories/reorder", json={"order": [id_b, id_a]})
        assert resp.status_code == 200
        cats = client.get("/api/v1/categories").json()["data"]
        assert cats[0]["name"] == "B"
        assert cats[1]["name"] == "A"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_api_categories.py -v
```

- [ ] **Step 3: Implement categories router**

Rewrite `backend/app/routers/categories.py` with full SQLite CRUD including reorder, duplicate detection, and cascading uncategorize on delete. Follow the same pattern as bookmarks router using `Depends(get_db)`, UUID generation, and ISO8601 timestamps.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_api_categories.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/categories.py tests/tibdp/backend/test_api_categories.py
git commit -m "feat: implement categories CRUD API with reorder support"
```

---

### Task 9: Implement Import/Export API

**Files:**
- Rewrite: `backend/app/routers/import_export.py`
- Rewrite: `tests/tibdp/backend/test_api_import_export.py`

- [ ] **Step 1: Write import/export tests**

Rewrite `tests/tibdp/backend/test_api_import_export.py`:

```python
class TestImportOnetab:
    def test_parse_basic(self, client):
        resp = client.post("/api/v1/import/onetab", json={
            "content": "https://spark-f18.tsmc.com | Spark F18\nhttps://airflow-f12.tsmc.com | Airflow F12"
        })
        assert resp.status_code == 200
        preview = resp.json()["data"]["preview"]
        assert len(preview) == 2
        assert preview[0]["title"] == "Spark F18"
        assert "f18" in preview[0]["tags"]
        assert preview[0]["category"] == "Spark"
        assert preview[1]["title"] == "Airflow F12"
        assert "f12" in preview[1]["tags"]

    def test_auto_detect_factory_tag(self, client):
        resp = client.post("/api/v1/import/onetab", json={
            "content": "https://grafana-f14a.tsmc.com/dashboard | Grafana"
        })
        preview = resp.json()["data"]["preview"]
        assert "f14a" in preview[0]["tags"]

    def test_auto_detect_category(self, client):
        resp = client.post("/api/v1/import/onetab", json={
            "content": "https://grafana.tsmc.com | Grafana Dashboard"
        })
        preview = resp.json()["data"]["preview"]
        assert preview[0]["category"] == "Monitoring"

    def test_url_only_no_title(self, client):
        resp = client.post("/api/v1/import/onetab", json={
            "content": "https://spark-f18.tsmc.com"
        })
        preview = resp.json()["data"]["preview"]
        assert preview[0]["url"] == "https://spark-f18.tsmc.com"
        assert preview[0]["title"] != ""

    def test_empty_content(self, client):
        resp = client.post("/api/v1/import/onetab", json={"content": ""})
        assert resp.json()["data"]["preview"] == []


class TestImportConfirm:
    def test_confirm_creates_bookmarks(self, client):
        resp = client.post("/api/v1/import/confirm", json={
            "bookmarks": [
                {"title": "Spark F18", "url": "https://spark-f18.tsmc.com", "tags": ["f18"], "category": "Spark"}
            ]
        })
        assert resp.status_code == 201
        assert resp.json()["data"]["imported_count"] == 1

    def test_auto_creates_category(self, client):
        client.post("/api/v1/import/confirm", json={
            "bookmarks": [
                {"title": "Test", "url": "https://test.com", "tags": [], "category": "NewCategory"}
            ]
        })
        cats = client.get("/api/v1/categories").json()["data"]
        assert any(c["name"] == "NewCategory" for c in cats)

    def test_empty_list(self, client):
        resp = client.post("/api/v1/import/confirm", json={"bookmarks": []})
        assert resp.json()["data"]["imported_count"] == 0


class TestExport:
    def test_export_empty(self, client):
        resp = client.get("/api/v1/export")
        assert resp.status_code == 200
        assert resp.json()["data"]["total"] == 0

    def test_export_with_data(self, client, seed_bookmark):
        resp = client.get("/api/v1/export")
        data = resp.json()["data"]
        assert data["total"] == 1
        assert len(data["categories"]) >= 1


class TestImportJson:
    def test_roundtrip(self, client, seed_bookmark):
        export_resp = client.get("/api/v1/export")
        export_data = export_resp.json()["data"]

        # clear everything
        bookmarks = client.get("/api/v1/bookmarks").json()["data"]["items"]
        for b in bookmarks:
            client.delete(f"/api/v1/bookmarks/{b['id']}")

        # reimport
        resp = client.post("/api/v1/import/json", json=export_data)
        assert resp.status_code == 201
        assert resp.json()["data"]["imported_count"] == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_api_import_export.py -v
```

- [ ] **Step 3: Implement import_export router**

Rewrite `backend/app/routers/import_export.py` with:
- `POST /import/onetab`: parse OneTab format, auto-detect factory tags via regex `f\d+[a-z]?`, auto-detect category from URL keywords (spark→Spark, airflow→Airflow, grafana→Monitoring)
- `POST /import/confirm`: create categories as needed, insert bookmarks
- `GET /export`: export all data grouped by category
- `POST /import/json`: restore from export format

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_api_import_export.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/import_export.py tests/tibdp/backend/test_api_import_export.py
git commit -m "feat: implement import/export API with OneTab parser and auto-tagging"
```

---

### Task 10: Implement Health Check API

**Files:**
- Create: `backend/app/routers/health.py`
- Create: `tests/tibdp/backend/test_api_health.py`

- [ ] **Step 1: Write health API tests**

Create `tests/tibdp/backend/test_api_health.py`:

```python
from unittest.mock import patch, MagicMock
import httpx


class TestHealthCheck:
    def test_trigger_empty_db(self, client):
        resp = client.post("/api/v1/health/check")
        assert resp.status_code == 200
        assert resp.json()["data"]["checked"] == 0

    def test_trigger_with_bookmarks(self, client, seed_bookmark):
        with patch("app.routers.health.httpx.Client") as MockClient:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.head.return_value = httpx.Response(200)
            MockClient.return_value = mock_client
            resp = client.post("/api/v1/health/check")
            assert resp.json()["data"]["checked"] == 1

    def test_status_empty(self, client):
        resp = client.get("/api/v1/health/status")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_status_after_check(self, client, seed_bookmark):
        with patch("app.routers.health.httpx.Client") as MockClient:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.head.return_value = httpx.Response(200)
            MockClient.return_value = mock_client
            client.post("/api/v1/health/check")
        resp = client.get("/api/v1/health/status")
        statuses = resp.json()["data"]
        assert len(statuses) == 1
        assert statuses[0]["is_healthy"] is True
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_api_health.py -v
```

- [ ] **Step 3: Implement health router**

Create `backend/app/routers/health.py` using **sync** httpx.Client (consistent with other sync routes):
- `POST /health/check`: fetch all bookmark URLs via `httpx.Client().head()`, store results in `health_checks` table
- `GET /health/status`: return most recent health check per bookmark (using subquery for latest per bookmark_id)

Also update `main.py` to import and include the health router.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_api_health.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/health.py tests/tibdp/backend/test_api_health.py
git commit -m "feat: implement health check API with httpx HEAD requests"
```

---

### Task 11: Implement Proxy API

**Files:**
- Rewrite: `backend/app/routers/proxy.py`
- Create: `tests/tibdp/backend/test_api_proxy.py`

- [ ] **Step 1: Write proxy API tests**

Create `tests/tibdp/backend/test_api_proxy.py`:

```python
from unittest.mock import patch, MagicMock
import httpx


class TestProxy:
    def test_missing_url_param(self, client):
        resp = client.get("/api/v1/proxy")
        assert resp.status_code == 422

    def test_successful_proxy(self, client):
        mock_response = httpx.Response(
            200,
            content=b"<html>Hello</html>",
            headers={"Content-Type": "text/html", "X-Frame-Options": "DENY"},
        )
        with patch("app.routers.proxy.httpx.Client") as MockClient:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_response
            MockClient.return_value = mock_client
            resp = client.get("/api/v1/proxy?url=https://example.com")
            assert resp.status_code == 200
            assert "X-Frame-Options" not in resp.headers

    def test_login_redirect_detected(self, client):
        mock_response = httpx.Response(
            302,
            headers={"Location": "https://sso.tsmc.com/login"},
        )
        with patch("app.routers.proxy.httpx.Client") as MockClient:
            mock_client = MagicMock()
            mock_client.__enter__ = MagicMock(return_value=mock_client)
            mock_client.__exit__ = MagicMock(return_value=False)
            mock_client.get.return_value = mock_response
            MockClient.return_value = mock_client
            resp = client.get("/api/v1/proxy?url=https://spark.tsmc.com")
            assert resp.status_code == 200
            body = resp.json()
            assert body["success"] is False
            assert "login" in body["message"].lower()
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_api_proxy.py -v
```

- [ ] **Step 3: Implement proxy router**

Rewrite `backend/app/routers/proxy.py` using **sync** httpx.Client (consistent with other routes):
- `GET /proxy?url=...`: fetch URL via `httpx.Client().get(url, follow_redirects=False)`, strip X-Frame-Options and CSP frame-ancestors headers from response, detect login redirects (check Location header for login/auth/sso keywords), return proxied content or error JSON

Also update `main.py` to import and include the proxy router.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/tibdp/backend/test_api_proxy.py -v
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/proxy.py tests/tibdp/backend/test_api_proxy.py
git commit -m "feat: implement proxy API for iframe embedding with login detection"
```

---

### Task 12: Add StaticFiles mount and run full backend test suite

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add StaticFiles mount to main.py**

Add at the end of `main.py` (after all router includes):

```python
import os
from fastapi.staticfiles import StaticFiles

frontend_dir = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
```

- [ ] **Step 2: Run full backend test suite**

```bash
cd backend && python -m pytest tests/tibdp/backend/ -v
```

Expected: ALL tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add StaticFiles mount to serve frontend"
```

---

## Phase 3: Frontend (Frontend Agent)

### Task 13: Create HTML skeleton and CSS design tokens

**Files:**
- Create: `frontend/index.html`
- Create: `frontend/css/variables.css`
- Create: `frontend/css/layout.css`
- Create: `frontend/css/components.css`
- Create: `frontend/css/utilities.css`

- [ ] **Step 1: Create index.html**

Create the main HTML file with the full layout structure (workspace bar, sidebar, main viewport). Include all CSS and JS file references. Define semantic containers: `#workspace-bar`, `#sidebar`, `#main-viewport`, `#tab-bar`, `#content-area`. Include modal containers.

- [ ] **Step 2: Create variables.css**

Define CSS Variables for light and dark themes:
- Colors: `--bg-primary`, `--bg-secondary`, `--bg-sidebar`, `--text-primary`, `--text-muted`, `--accent`, `--border`, `--danger`, etc.
- Light theme as default on `:root`
- Dark theme on `[data-theme="dark"]`
- Spacing: `--space-1` through `--space-8`
- Font sizes: `--text-xs`, `--text-sm`, `--text-base`
- Border radius: `--radius-sm`, `--radius-md`

- [ ] **Step 3: Create layout.css**

Define layout grid: sidebar 320px fixed, main viewport fills remaining. Workspace bar full-width 40px height. Sidebar footer sticky bottom. Main viewport = tab bar (40px) + content area (fill).

- [ ] **Step 4: Create components.css**

Stub styles for: workspace chips, sidebar search, category groups, bookmark items, tab bar tabs, modals, buttons, inputs, health dots, error cards.

- [ ] **Step 5: Create utilities.css**

Utility classes: `.truncate`, `.hidden`, `.flex`, `.flex-col`, `.gap-1`, `.gap-2`, etc.

- [ ] **Step 6: Verify in browser**

```bash
cd backend && python -m uvicorn app.main:app --reload
```

Open `http://localhost:8000` — should see basic layout structure with workspace bar, sidebar, and main viewport.

- [ ] **Step 7: Commit**

```bash
git add frontend/
git commit -m "feat: create HTML skeleton and CSS design system with dark/light tokens"
```

---

### Task 14: Implement API client and state store

**Files:**
- Create: `frontend/js/api.js`
- Create: `frontend/js/store.js`

- [ ] **Step 1: Create api.js**

Wrap all `/api/v1/` endpoints with fetch calls. Each method returns parsed JSON. Methods: `listBookmarks(params)`, `getBookmark(id)`, `createBookmark(data)`, `updateBookmark(id, data)`, `deleteBookmark(id)`, `updateAccess(id)`, `listCategories()`, `createCategory(data)`, `updateCategory(id, data)`, `deleteCategory(id)`, `reorderCategories(order)`, `importOnetab(content)`, `importConfirm(bookmarks)`, `exportData()`, `importJson(data)`, `triggerHealthCheck()`, `getHealthStatus()`.

- [ ] **Step 2: Create store.js**

Implement pub/sub store with:
- State: `bookmarks`, `categories`, `tabs`, `activeTabId`, `activeWorkspace`, `searchQuery`, `collapsedCategories`, `healthStatus`
- Methods: `subscribe(event, callback)`, `emit(event, data)`, `setState(key, value)`
- Data methods that call API and update state: `loadBookmarks()`, `loadCategories()`, etc.
- Tab management: `openTab(bookmark)`, `closeTab(id)`, `openCombinedTab(b1, b2)`
- Derived: `getFilteredBookmarks()` — filter by workspace + search

- [ ] **Step 3: Commit**

```bash
git add frontend/js/api.js frontend/js/store.js
git commit -m "feat: implement API client and pub/sub state store"
```

---

### Task 15: Implement workspace bar and sidebar

**Files:**
- Create: `frontend/js/components/workspace-bar.js`
- Create: `frontend/js/components/sidebar.js`
- Create: `frontend/js/utils/fuzzy-search.js`

- [ ] **Step 1: Create workspace-bar.js**

Render factory tag chips (ALL, f12, f14a, f14b, ..., ftestdev). Click sets `activeWorkspace` in store. Active chip gets highlighted style. Subscribe to workspace changes to update UI.

- [ ] **Step 2: Create fuzzy-search.js**

Implement simple fuzzy search: match if all characters of query appear in order in the target string. Export `fuzzyMatch(query, text)` returning `{match: boolean, score: number}` and `fuzzyFilter(query, items, keys)` returning sorted matches.

- [ ] **Step 3: Create sidebar.js**

Render: search input, category groups (collapsible), bookmark items within each group, footer actions. Subscribe to store changes (bookmarks, categories, searchQuery, activeWorkspace). Implement category collapse toggle. Bookmark click calls `store.openTab(bookmark)`. Bookmark right-click shows context menu (Edit, Delete, Open in New Window).

- [ ] **Step 4: Test in browser**

Verify: workspace bar renders all factory chips, sidebar shows categories and bookmarks from API, search filters in real-time, category collapse works.

- [ ] **Step 5: Commit**

```bash
git add frontend/js/components/workspace-bar.js frontend/js/components/sidebar.js frontend/js/utils/fuzzy-search.js
git commit -m "feat: implement workspace bar, sidebar with fuzzy search"
```

---

### Task 16: Implement tab bar and SmartIframe

**Files:**
- Create: `frontend/js/components/tab-bar.js`
- Create: `frontend/js/components/smart-iframe.js`

- [ ] **Step 1: Create tab-bar.js**

Render tab bar from `store.tabs`. Each tab shows title + close button. Click switches active tab. Active tab gets highlighted border. Empty state: "Open a bookmark from the sidebar to get started."

- [ ] **Step 2: Create smart-iframe.js**

Render iframe in content area for active tab. Features:
- Loading spinner overlay while iframe loads
- `sandbox="allow-same-origin allow-scripts allow-forms allow-popups"` (no `allow-top-navigation`)
- Use proxy URL: `src="/api/v1/proxy?url=${encodeURIComponent(url)}"`
- On iframe load error: show error card with AlertTriangle icon + "Open in New Window" button
- On proxy returning login error JSON: show "This page requires login" message + button

- [ ] **Step 3: Test in browser**

Click a bookmark → tab appears → iframe loads via proxy. Click another → new tab. Click existing tab URL → focuses instead of duplicating. Close tab works.

- [ ] **Step 4: Commit**

```bash
git add frontend/js/components/tab-bar.js frontend/js/components/smart-iframe.js
git commit -m "feat: implement tab bar and SmartIframe with proxy and error handling"
```

---

### Task 17: Implement modals

**Files:**
- Create: `frontend/js/components/modals.js`

- [ ] **Step 1: Create modals.js**

Implement all modals as functions that render into a modal container:

1. **BookmarkFormModal(bookmark?)** — Add/Edit. Fields: title, URL, category (dropdown), factory tags (toggle chips), is_combined checkbox. Save calls API.
2. **ImportModal** — Textarea for OneTab paste, Parse button, preview table (editable inline), confirm button.
3. **DeleteConfirmModal(title, onConfirm)** — Confirmation with red delete button.
4. **CategoryManageModal** — List categories with edit/delete/reorder. Drag handles use HTML5 DnD API. New category input at top.

All modals: backdrop overlay, close on Escape, close on backdrop click, trap focus.

- [ ] **Step 2: Wire up sidebar actions**

Connect sidebar footer buttons to modals: "+ Add Bookmark" → BookmarkFormModal(), "Import" → ImportModal(), "Export" → triggers API download.

- [ ] **Step 3: Wire up bookmark context menu**

Connect right-click Edit → BookmarkFormModal(bookmark), Delete → DeleteConfirmModal.

- [ ] **Step 4: Test in browser**

Verify all modals open/close, form submission creates/updates data, import flow works end-to-end, category management works.

- [ ] **Step 5: Commit**

```bash
git add frontend/js/components/modals.js
git commit -m "feat: implement all modals (bookmark form, import, delete confirm, category manage)"
```

---

### Task 18: Implement split view (combined view)

**Files:**
- Create: `frontend/js/components/split-view.js`

- [ ] **Step 1: Create split-view.js**

Implement combined view:
- Detect bookmark pairs: same factory tag + complementary keyword (spark↔airflow)
- When opening a combinable bookmark, show `CombinedViewBanner` at top of content
- "Open Combined View" creates split tab with two SmartIframe panes (50/50)
- Each pane has header: title + refresh + open in new window + exit split
- "Exit Split" reverts to single pane

- [ ] **Step 2: Test in browser**

Add two related bookmarks (e.g., Spark F18 + Airflow F18). Open one → banner suggests combined view. Click → split screen renders.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/components/split-view.js
git commit -m "feat: implement combined/split view with auto-detection"
```

---

### Task 19: Implement keyboard navigation

**Files:**
- Create: `frontend/js/utils/keyboard-nav.js`

- [ ] **Step 1: Create keyboard-nav.js**

Implement global keyboard handler:
- `/` → focus search input (except when already in an input)
- `ArrowDown` / `ArrowUp` → navigate sidebar bookmark items, update `keyboardNavIndex`
- `Enter` → open highlighted bookmark
- `Escape` → clear search, blur input, reset nav index
- Navigation wraps around (bottom→top, top→bottom)
- Visual highlight on navigated item

- [ ] **Step 2: Test in browser**

Press `/` → search focuses. Type query → results filter. Arrow keys navigate. Enter opens. Escape clears.

- [ ] **Step 3: Commit**

```bash
git add frontend/js/utils/keyboard-nav.js
git commit -m "feat: implement keyboard navigation for sidebar"
```

---

### Task 20: Implement dark/light mode and app initialization

**Files:**
- Create: `frontend/js/utils/theme.js`
- Create: `frontend/js/router.js`
- Create: `frontend/js/app.js`

- [ ] **Step 1: Create theme.js**

- Read system preference via `matchMedia('(prefers-color-scheme: dark)')`
- Read saved preference from localStorage
- Apply theme by setting `document.documentElement.dataset.theme`
- Export `toggleTheme()`, `initTheme()`
- Listen for system preference changes

- [ ] **Step 2: Create router.js**

Simple workspace filter state manager:
- `setWorkspace(tag)` → update store, re-render sidebar
- `getWorkspace()` → current filter

- [ ] **Step 3: Create app.js**

Entry point:
- `initTheme()`
- `init_db()` equivalent: call `store.loadCategories()` and `store.loadBookmarks()`
- Initialize all components: `WorkspaceBar.init()`, `Sidebar.init()`, `TabBar.init()`, `KeyboardNav.init()`
- Start health check interval: `triggerHealthCheck()` then `setInterval(triggerHealthCheck, 60000)`

- [ ] **Step 4: Full integration test in browser**

Start server, open app. Verify:
- Layout renders correctly
- Dark/light mode toggle works
- Workspace filter works
- Sidebar search + keyboard nav works
- Tab management works
- Modals work
- Import/export flow works
- Health indicators show

- [ ] **Step 5: Commit**

```bash
git add frontend/js/utils/theme.js frontend/js/router.js frontend/js/app.js
git commit -m "feat: implement theme switcher, router, and app initialization"
```

---

### Task 21: Frontend unit tests for pure logic modules

**Files:**
- Create: `tests/tibdp/frontend/test_fuzzy_search.js`
- Create: `tests/tibdp/frontend/test_onetab_parser.js`

Per spec: "Pure logic modules (fuzzy-search.js, onetab-parser.js) testable via Node.js."

- [ ] **Step 1: Write fuzzy search tests**

Create `tests/tibdp/frontend/test_fuzzy_search.js` using Node.js assert:

```javascript
import { fuzzyMatch, fuzzyFilter } from '../../../frontend/js/utils/fuzzy-search.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('fuzzyMatch', () => {
  it('matches exact string', () => {
    assert.strictEqual(fuzzyMatch('spark', 'Spark F18').match, true);
  });
  it('matches partial', () => {
    assert.strictEqual(fuzzyMatch('sf18', 'Spark F18').match, true);
  });
  it('no match', () => {
    assert.strictEqual(fuzzyMatch('xyz', 'Spark F18').match, false);
  });
  it('empty query matches all', () => {
    assert.strictEqual(fuzzyMatch('', 'anything').match, true);
  });
});

describe('fuzzyFilter', () => {
  const items = [
    { title: 'Spark F18', tags: ['f18'] },
    { title: 'Airflow F12', tags: ['f12'] },
    { title: 'Grafana F18', tags: ['f18'] },
  ];
  it('filters by title', () => {
    const result = fuzzyFilter('spark', items, ['title']);
    assert.strictEqual(result.length, 1);
  });
  it('returns empty for no match', () => {
    const result = fuzzyFilter('zzz', items, ['title']);
    assert.strictEqual(result.length, 0);
  });
});
```

- [ ] **Step 2: Write OneTab parser tests**

Create `tests/tibdp/frontend/test_onetab_parser.js`:

```javascript
import { parseOnetab } from '../../../frontend/js/utils/onetab-parser.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('parseOnetab', () => {
  it('parses URL | Title format', () => {
    const result = parseOnetab('https://spark-f18.tsmc.com | Spark F18');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].url, 'https://spark-f18.tsmc.com');
    assert.strictEqual(result[0].title, 'Spark F18');
  });
  it('parses URL-only line', () => {
    const result = parseOnetab('https://spark-f18.tsmc.com');
    assert.strictEqual(result.length, 1);
    assert.ok(result[0].title.length > 0);
  });
  it('auto-detects factory tag', () => {
    const result = parseOnetab('https://spark-f18.tsmc.com | Spark');
    assert.ok(result[0].tags.includes('f18'));
  });
  it('auto-detects category', () => {
    const result = parseOnetab('https://grafana.tsmc.com | Grafana');
    assert.strictEqual(result[0].category, 'Monitoring');
  });
  it('handles multiple lines', () => {
    const result = parseOnetab('https://a.com | A\nhttps://b.com | B');
    assert.strictEqual(result.length, 2);
  });
  it('skips empty lines', () => {
    const result = parseOnetab('https://a.com | A\n\nhttps://b.com | B');
    assert.strictEqual(result.length, 2);
  });
});
```

- [ ] **Step 3: Run tests**

```bash
node --test tests/tibdp/frontend/test_fuzzy_search.js
node --test tests/tibdp/frontend/test_onetab_parser.js
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/tibdp/frontend/
git commit -m "test: add Node.js unit tests for fuzzy-search and onetab-parser"
```

---

## Phase 4: Quality

### Task 22: Code Review

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend && python -m pytest tests/tibdp/backend/ -v --tb=short
```

Expected: All tests PASS.

- [ ] **Step 2: Dispatch Code Reviewer agent**

Code Reviewer examines:
- Backend: security (SQL injection via parameterized queries, proxy URL validation, input sanitization)
- Frontend: XSS prevention, proper escaping of user input in DOM manipulation
- API consistency: all endpoints follow `{ data, message, success }` format
- Error handling: proper HTTP status codes, meaningful error messages

- [ ] **Step 3: Fix any issues found**

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: address code review findings"
```

---

### Task 23: QA Testing

- [ ] **Step 1: Run backend tests with coverage**

```bash
cd backend && python -m pytest tests/tibdp/backend/ -v --cov=app --cov-report=term-missing
```

- [ ] **Step 2: Manual frontend testing checklist**

Test each PRD feature requirement:
- [ ] FR-4.1: Sidebar with categories, bookmark counts, fuzzy search, keyboard nav
- [ ] FR-4.2: Tab management, deduplication, close
- [ ] FR-4.3: Iframe error fallback, "Open in New Window"
- [ ] FR-4.4: Combined view auto-detection, split screen
- [ ] FR-4.5: OneTab import with preview and auto-tagging
- [ ] FR-4.6: CRUD bookmarks and categories, export/import JSON
- [ ] FR-4.7: Responsive at 1920x1080, health indicators, workspace switcher, dark/light mode

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address QA findings"
```

---

### Task 24: Final integration and deploy preparation

- [ ] **Step 1: Verify full app startup**

```bash
cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open `http://localhost:8000` — verify complete application works.

- [ ] **Step 2: Run all tests one final time**

```bash
cd backend && python -m pytest tests/tibdp/backend/ -v
```

- [ ] **Step 3: Commit any remaining changes**

- [ ] **Step 4: Ready for PR / DevOps deployment**

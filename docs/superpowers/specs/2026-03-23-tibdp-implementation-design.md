# TIBDP Implementation Design Spec

> Date: 2026-03-23
> Status: Approved
> Branch: feature/tibdp

## 1. Overview

Implementation spec for TSMC Internal Bookmark & Dashboard Portal (TIBDP). A centralized bookmark management system for semiconductor engineers to manage tool URLs across multiple TSMC factory sites.

**Tech Stack:**
- Frontend: Pure HTML5 + CSS3 + Vanilla JavaScript (no frameworks, no build tools)
- Backend: Python FastAPI (serves API + static frontend files)
- Database: SQLite
- Deployment: Single Python backend service

> **Supersedes:** This spec supersedes the following sections in upstream documents:
> - PRD Sections 2 (Tech Stack), 6 (Priority — Zustand references), 8 (API Notes — "no backend"), NFR-4 ("no backend server")
> - Design doc Sections 7 (State Management — Zustand stores), 9 (Dark/Light Mode — Tailwind dark: classes)
>
> Phase 1 cleanup will update these documents to match this spec.

## 2. Database Schema

SQLite database at `backend/data/bookmarks.db`.

### bookmarks

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY, UUID |
| title | TEXT | NOT NULL |
| url | TEXT | NOT NULL |
| category_id | TEXT | FOREIGN KEY → categories.id, nullable |
| tags | TEXT | JSON array string, e.g. '["f18","f14a"]' |
| is_combined | BOOLEAN | DEFAULT 0 |
| last_accessed | INTEGER | Unix timestamp |
| created_at | TEXT | ISO8601 |
| updated_at | TEXT | ISO8601 |

### categories

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY, UUID |
| name | TEXT | NOT NULL, UNIQUE |
| display_order | INTEGER | DEFAULT 0 |
| created_at | TEXT | ISO8601 |
| updated_at | TEXT | ISO8601 |

### health_checks

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PRIMARY KEY, AUTOINCREMENT |
| bookmark_id | TEXT | FOREIGN KEY → bookmarks.id |
| is_healthy | BOOLEAN | |
| status_code | INTEGER | |
| checked_at | TEXT | ISO8601 |

## 3. Backend API Design

All APIs use prefix `/api/v1/`. Response format: `{ "data": ..., "message": "...", "success": true/false }`.

> **Note:** CLAUDE.md currently uses `"code"` instead of `"success"`. Phase 1 cleanup will update CLAUDE.md to use `"success"` for consistency.

### 3.1 Bookmarks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /bookmarks | List bookmarks (paginated). Query params: tag, search, category_id, page, per_page |
| GET | /bookmarks/{id} | Get single bookmark by ID |
| POST | /bookmarks | Create bookmark |
| PUT | /bookmarks/{id} | Update bookmark |
| DELETE | /bookmarks/{id} | Delete bookmark |
| PATCH | /bookmarks/{id}/access | Update last_accessed timestamp |

**GET /bookmarks response format (paginated):**
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "Spark F18",
        "url": "https://spark-f18.tsmc.com",
        "category_id": "uuid",
        "category_name": "Spark",
        "tags": ["f18"],
        "is_combined": false,
        "last_accessed": 1711200000,
        "created_at": "2026-03-23T10:00:00Z",
        "updated_at": "2026-03-23T10:00:00Z"
      }
    ],
    "total": 500,
    "page": 1,
    "per_page": 20
  },
  "message": "Bookmarks retrieved successfully",
  "success": true
}
```

Note: `category_name` is included via JOIN so the frontend does not need a separate lookup.

### 3.2 Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /categories | List categories with bookmark_count |
| POST | /categories | Create category |
| PUT | /categories/{id} | Update category name |
| DELETE | /categories/{id} | Delete category (bookmarks become uncategorized) |
| PUT | /categories/reorder | Batch update display_order |

### 3.3 Import / Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /import/onetab | Parse OneTab text, return preview |
| POST | /import/confirm | Confirm and save parsed bookmarks |
| GET | /export | Export all data as JSON |
| POST | /import/json | Restore from exported JSON |

**POST /import/onetab request:**
```json
{
  "content": "https://spark-f18.tsmc.com | Spark F18\nhttps://airflow-f18.tsmc.com | Airflow F18"
}
```

**POST /import/onetab response (preview):**
```json
{
  "data": {
    "preview": [
      {
        "temp_id": 0,
        "title": "Spark F18",
        "url": "https://spark-f18.tsmc.com",
        "tags": ["f18"],
        "category": "Spark"
      }
    ]
  },
  "message": "2 bookmarks parsed",
  "success": true
}
```

**POST /import/confirm request:**
```json
{
  "bookmarks": [
    {
      "title": "Spark F18",
      "url": "https://spark-f18.tsmc.com",
      "tags": ["f18"],
      "category": "Spark"
    }
  ]
}
```

The confirm endpoint auto-creates categories that don't exist yet.

### 3.4 Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /health/check | Trigger health check for all bookmarks |
| GET | /health/status | Get latest health status for all bookmarks |

**Health check trigger:** The frontend calls `POST /health/check` on page load and every 60 seconds thereafter. The backend performs HTTP HEAD requests to each bookmark URL asynchronously and stores results in `health_checks` table. `GET /health/status` returns the most recent check result per bookmark.

### 3.5 Proxy

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /proxy | Proxy requests for iframe embedding. Query param: url |

Proxy behavior:
- Forwards request with original cookies/headers
- Removes X-Frame-Options and CSP frame-ancestors from response
- Detects 301/302 redirects to login/auth/SSO URLs and returns error instead of following
- Prevents iframe top-level navigation issues

### 3.6 Static Files

FastAPI mounts `frontend/` directory as StaticFiles, serving `index.html` as the root.

## 4. Frontend Architecture

### 4.1 File Structure

```
frontend/
├── index.html
├── css/
│   ├── variables.css    — CSS Variables (design tokens, dark/light)
│   ├── layout.css       — Overall layout (sidebar, viewport, workspace bar)
│   ├── components.css   — Component styles (tabs, bookmarks, modals)
│   └── utilities.css    — Utility classes
└── js/
    ├── app.js           — Entry point, initializes all modules
    ├── api.js           — Wraps all /api/v1/ calls
    ├── store.js         — State management (plain JS objects + event pub/sub)
    ├── router.js        — Workspace filter state
    ├── components/
    │   ├── workspace-bar.js
    │   ├── sidebar.js
    │   ├── tab-bar.js
    │   ├── smart-iframe.js
    │   ├── split-view.js
    │   └── modals.js
    └── utils/
        ├── fuzzy-search.js
        ├── onetab-parser.js
        ├── keyboard-nav.js
        └── theme.js
```

### 4.2 State Management

Pure JavaScript pub/sub pattern:
- `store.js` holds application state (bookmarks, categories, tabs, UI state)
- Components subscribe to state changes and re-render relevant DOM sections
- No framework dependency

### 4.3 CSS Strategy

- CSS Variables for all design tokens (colors, spacing, font sizes)
- Dark/light mode via CSS Variables swap on `<html>` data attribute
- Default follows `prefers-color-scheme`, user can override via settings toggle
- Theme preference persisted to localStorage

### 4.4 Icons

All icons are hand-coded inline SVGs embedded directly in JavaScript component rendering. No icon library dependency. Required icons (referenced from design doc):
- Search, X (close), ChevronRight/ChevronDown (collapse), Columns2 (combined view), AlertTriangle (error), Plus, Upload, Download, Settings (gear), Trash, Pencil (edit), RefreshCw, ExternalLink, GripVertical (drag handle)

### 4.5 Iframe Handling

SmartIframe component:
- Loading state: centered spinner overlay
- Error detection: catches load failures (CORS, X-Frame-Options, CSP)
- Error fallback: error card with "Open in New Window" button
- Login detection: if proxy detects auth redirect, shows "This page requires login" prompt
- Sandbox attribute: prevents top-level navigation (login redirects won't take over the page)

### 4.6 Key Interactions

- **Keyboard navigation:** `/` focuses search, arrows navigate, Enter opens, Escape clears
- **Tab deduplication:** opening an already-open URL focuses existing tab
- **Combined view:** auto-detects related bookmarks (same factory, Spark↔Airflow), offers split-screen
- **OneTab import:** paste text → parse → preview table → edit → confirm import
- **Health indicators:** colored dots (green/red/gray) on bookmark items
- **Category reorder:** uses native HTML5 Drag and Drop API for drag handles; no library needed

## 5. Testing Strategy

### Backend (pytest)

- `test_models_validation.py` — Pydantic model validation
- `test_api_bookmarks.py` — Bookmark CRUD API
- `test_api_categories.py` — Category CRUD API
- `test_api_import_export.py` — OneTab import/export
- `test_api_health.py` — Health check API
- `test_api_proxy.py` — Proxy endpoint
- Test database: SQLite in-memory

### Frontend

- Pure logic modules (fuzzy-search.js, onetab-parser.js) testable via Node.js
- UI interactions verified manually

## 6. Implementation Phases

### Phase 1 — Cleanup (Team Lead)
- Delete frontend/node_modules/
- Update docs/designs/tibdp.md: remove React/Zustand/Tailwind references, replace with vanilla JS/CSS equivalents
- Update docs/prd/tibdp.md: remove Zustand references, update NFR-4, update Section 8 API notes
- Update CLAUDE.md: change API response format from `"code"` to `"success"`
- Create docs/designs/api-tibdp.md (extract API details from this spec)

### Phase 2 — Backend (Backend Agent)
- SQLite DB layer + table creation
- Bookmarks CRUD API (including GET single bookmark)
- Categories CRUD API
- Import/Export API (OneTab parser)
- Health check API
- Proxy API
- StaticFiles configuration

### Phase 3 — Frontend (Frontend Agent)
- index.html + CSS architecture + design tokens
- store.js (pub/sub) + api.js
- Workspace bar + sidebar (search, categories, bookmark list)
- Tab bar + SmartIframe
- Modals (add/edit/delete/import)
- Split view (combined view)
- Keyboard navigation + fuzzy search
- Dark/light mode
- Category drag-and-drop reorder (HTML5 DnD API)

### Phase 4 — Quality (Code Reviewer + QA + DevOps)
- Code review
- Test execution
- Deployment

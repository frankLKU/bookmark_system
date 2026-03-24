# API Interface Document — TIBDP

> Date: 2026-03-23
> Branch: feature/tibdp
> Status: Approved
> Source: docs/superpowers/specs/2026-03-23-tibdp-implementation-design.md (Sections 3.1–3.6)

## Overview

All endpoints use prefix `/api/v1/`. The backend is a Python FastAPI service that also serves the static frontend.

**Standard response format:**
```json
{
  "data": "<any>",
  "message": "<string>",
  "success": true
}
```

> Note: CLAUDE.md currently uses `"code"` instead of `"success"`. This document uses `"success"` as the canonical field name. CLAUDE.md will be updated in Phase 1 cleanup to match.

---

## Data Types

### FactoryTag

```
f12 | f14a | f14b | f15a | f15b | f16 | f18 | f18b | f20 | f21 | f22 | f23 | foc | ftest | ftestdev
```

### Bookmark (API representation)

```json
{
  "id": "uuid-string",
  "title": "string",
  "url": "string",
  "category_id": "uuid-string or null",
  "category_name": "string or null",
  "tags": ["f18", "f14a"],
  "is_combined": false,
  "last_accessed": 1711036800,
  "created_at": "2026-03-23T10:00:00Z",
  "updated_at": "2026-03-23T10:00:00Z"
}
```

### Category (API representation)

```json
{
  "id": "uuid-string",
  "name": "string",
  "display_order": 0,
  "bookmark_count": 15,
  "created_at": "2026-03-23T10:00:00Z",
  "updated_at": "2026-03-23T10:00:00Z"
}
```

---

## Error Responses

All errors follow the standard response format:

```json
{
  "data": null,
  "message": "Descriptive error message",
  "success": false
}
```

| HTTP Status | Usage |
|-------------|-------|
| 400 | Bad Request — validation error (missing required fields, invalid URL, invalid FactoryTag) |
| 404 | Not Found — bookmark or category UUID does not exist |
| 409 | Conflict — duplicate URL on bookmark creation, duplicate category name |
| 422 | Unprocessable Entity — valid JSON but semantically invalid |
| 500 | Internal Server Error |

---

## 3.1 Bookmarks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/bookmarks` | List bookmarks (paginated) |
| GET | `/api/v1/bookmarks/{id}` | Get single bookmark by ID |
| POST | `/api/v1/bookmarks` | Create bookmark |
| PUT | `/api/v1/bookmarks/{id}` | Update bookmark |
| DELETE | `/api/v1/bookmarks/{id}` | Delete bookmark |
| PATCH | `/api/v1/bookmarks/{id}/access` | Update last_accessed timestamp |

### GET /api/v1/bookmarks

List bookmarks with optional filtering and pagination.

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| tag | string | No | Filter by factory tag (e.g., `f18`). Multiple allowed: `?tag=f18&tag=f14a` |
| search | string | No | Full-text search in title and tags |
| category_id | string (UUID) | No | Filter by category |
| page | integer | No | Page number (default: 1) |
| per_page | integer | No | Items per page (default: 20) |

**Response (200):**
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

> `category_name` is included via JOIN so the frontend does not need a separate lookup.

---

### GET /api/v1/bookmarks/{id}

Get a single bookmark by ID.

**Response (200):**
```json
{
  "data": {
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
  },
  "message": "Bookmark retrieved successfully",
  "success": true
}
```

---

### POST /api/v1/bookmarks

Create a new bookmark.

**Request body:**
```json
{
  "title": "Spark F18",
  "url": "https://spark-f18.tsmc.com",
  "category_id": "uuid",
  "tags": ["f18"],
  "is_combined": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | Yes | Display name, max 100 chars |
| url | string | Yes | Valid URL |
| category_id | string (UUID) | No | Category UUID. Null = uncategorized |
| tags | string[] | No | Array of FactoryTag values. Default: [] |
| is_combined | boolean | No | Default: false |

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "title": "Spark F18",
    "url": "https://spark-f18.tsmc.com",
    "category_id": "uuid",
    "category_name": "Spark",
    "tags": ["f18"],
    "is_combined": false,
    "last_accessed": null,
    "created_at": "2026-03-23T10:00:00Z",
    "updated_at": "2026-03-23T10:00:00Z"
  },
  "message": "Bookmark created successfully",
  "success": true
}
```

---

### PUT /api/v1/bookmarks/{id}

Update an existing bookmark. All fields are optional; only provided fields are updated.

**Request body:**
```json
{
  "title": "Updated Title",
  "url": "https://spark-f18.tsmc.com",
  "category_id": "uuid",
  "tags": ["f18", "f14a"],
  "is_combined": true
}
```

**Response (200):** Returns the full updated bookmark object in `data` (same shape as GET single bookmark).

---

### DELETE /api/v1/bookmarks/{id}

Delete a bookmark.

**Response (200):**
```json
{
  "data": null,
  "message": "Bookmark deleted successfully",
  "success": true
}
```

---

### PATCH /api/v1/bookmarks/{id}/access

Update the `last_accessed` timestamp to the current Unix time. No request body required. Called by the frontend whenever a user opens a bookmark.

**Response (200):**
```json
{
  "data": null,
  "message": "Access time updated",
  "success": true
}
```

---

## 3.2 Categories

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/categories` | List categories with bookmark count |
| POST | `/api/v1/categories` | Create category |
| PUT | `/api/v1/categories/{id}` | Update category name |
| DELETE | `/api/v1/categories/{id}` | Delete category |
| PUT | `/api/v1/categories/reorder` | Batch update display_order |

### GET /api/v1/categories

List all categories ordered by `display_order`, with bookmark counts included.

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Spark",
      "display_order": 0,
      "bookmark_count": 12,
      "created_at": "2026-03-23T10:00:00Z",
      "updated_at": "2026-03-23T10:00:00Z"
    }
  ],
  "message": "Categories retrieved successfully",
  "success": true
}
```

---

### POST /api/v1/categories

Create a new category.

**Request body:**
```json
{
  "name": "Spark"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Category name, must be unique |

**Response (201):**
```json
{
  "data": {
    "id": "uuid",
    "name": "Spark",
    "display_order": 0,
    "bookmark_count": 0,
    "created_at": "2026-03-23T10:00:00Z",
    "updated_at": "2026-03-23T10:00:00Z"
  },
  "message": "Category created successfully",
  "success": true
}
```

---

### PUT /api/v1/categories/{id}

Update a category's name.

**Request body:**
```json
{
  "name": "Spark Tools"
}
```

**Response (200):** Returns the full updated category object in `data`.

---

### DELETE /api/v1/categories/{id}

Delete a category. Bookmarks belonging to the deleted category become uncategorized (`category_id = null`).

**Response (200):**
```json
{
  "data": null,
  "message": "Category deleted successfully",
  "success": true
}
```

---

### PUT /api/v1/categories/reorder

Batch update `display_order` for multiple categories in one request.

**Request body:**
```json
{
  "order": [
    { "id": "uuid-1", "display_order": 0 },
    { "id": "uuid-2", "display_order": 1 },
    { "id": "uuid-3", "display_order": 2 }
  ]
}
```

**Response (200):**
```json
{
  "data": null,
  "message": "Categories reordered successfully",
  "success": true
}
```

---

## 3.3 Import / Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/import/onetab` | Parse OneTab text, return preview (does not save) |
| POST | `/api/v1/import/confirm` | Confirm and save parsed bookmarks |
| GET | `/api/v1/export` | Export all data as JSON |
| POST | `/api/v1/import/json` | Restore from exported JSON |

### POST /api/v1/import/onetab

Parses raw OneTab-format text into a preview list. Does not persist anything — user must confirm via `POST /api/v1/import/confirm`.

**Request body:**
```json
{
  "content": "https://spark-f18.tsmc.com | Spark F18\nhttps://airflow-f18.tsmc.com | Airflow F18"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| content | string | Yes | Raw OneTab export text. Format: `URL | Title` per line, or just `URL` |

**Response (200):**
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
      },
      {
        "temp_id": 1,
        "title": "Airflow F18",
        "url": "https://airflow-f18.tsmc.com",
        "tags": ["f18"],
        "category": "Airflow"
      }
    ]
  },
  "message": "2 bookmarks parsed",
  "success": true
}
```

**Auto-detection rules:**
- Factory tags: regex `f\d+[a-z]?` matched against URL hostname (e.g., `spark-f18.tsmc.com` → `f18`)
- Category: URL keyword mapping (e.g., `spark` → "Spark", `airflow` → "Airflow", `grafana` → "Monitoring")
- Title: uses provided title, or falls back to hostname if not given

---

### POST /api/v1/import/confirm

Confirms and saves the reviewed/edited bookmark list. Auto-creates categories that do not yet exist.

**Request body:**
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

**Response (201):**
```json
{
  "data": {
    "created": 1
  },
  "message": "1 bookmark imported successfully",
  "success": true
}
```

---

### GET /api/v1/export

Export all bookmarks and categories as a JSON blob for backup/restore.

**Response (200):**
```json
{
  "data": {
    "bookmarks": [
      {
        "id": "uuid",
        "title": "Spark F18",
        "url": "https://spark-f18.tsmc.com",
        "category_id": "uuid",
        "tags": ["f18"],
        "is_combined": false,
        "last_accessed": 1711200000,
        "created_at": "2026-03-23T10:00:00Z",
        "updated_at": "2026-03-23T10:00:00Z"
      }
    ],
    "categories": [
      {
        "id": "uuid",
        "name": "Spark",
        "display_order": 0,
        "created_at": "2026-03-23T10:00:00Z",
        "updated_at": "2026-03-23T10:00:00Z"
      }
    ]
  },
  "message": "Export successful",
  "success": true
}
```

---

### POST /api/v1/import/json

Restore from a previously exported JSON blob.

**Request body:** Same shape as the `data` object returned by `GET /api/v1/export`.

**Response (200):**
```json
{
  "data": {
    "bookmarks_imported": 42,
    "categories_imported": 5
  },
  "message": "Import successful",
  "success": true
}
```

---

## 3.4 Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/health/check` | Trigger health check for all bookmarks |
| GET | `/api/v1/health/status` | Get latest health status for all bookmarks |

### Health Check Trigger Mechanism

The frontend calls `POST /api/v1/health/check` on page load and then every 60 seconds thereafter. The backend performs HTTP HEAD requests to each bookmark URL asynchronously and stores results in the `health_checks` table. `GET /api/v1/health/status` returns the most recent check result per bookmark. The frontend uses these results to render colored health indicator dots (green/red/gray) on bookmark items.

---

### POST /api/v1/health/check

Triggers an asynchronous health check run for all bookmarks. Returns immediately; HEAD requests are made in the background.

**Response (200):**
```json
{
  "data": null,
  "message": "Health check triggered",
  "success": true
}
```

---

### GET /api/v1/health/status

Returns the most recent health check result for each bookmark.

**Response (200):**
```json
{
  "data": [
    {
      "bookmark_id": "uuid",
      "is_healthy": true,
      "status_code": 200,
      "checked_at": "2026-03-23T10:00:00Z"
    },
    {
      "bookmark_id": "uuid-2",
      "is_healthy": false,
      "status_code": 503,
      "checked_at": "2026-03-23T10:00:00Z"
    }
  ],
  "message": "Health status retrieved successfully",
  "success": true
}
```

---

## 3.5 Proxy

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/proxy` | Proxy a URL for iframe embedding |

### GET /api/v1/proxy

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| url | string | Yes | The target URL to proxy |

**Example:** `GET /api/v1/proxy?url=https://spark-f18.tsmc.com`

### Proxy Behavior

- Forwards the request with original cookies and headers from the client
- Removes `X-Frame-Options` and `Content-Security-Policy: frame-ancestors` headers from the upstream response to enable iframe embedding
- Detects 301/302 redirects to login/auth/SSO URLs and returns an error response instead of following the redirect — prevents silent auth loops inside iframes
- Prevents iframe top-level navigation issues

**Success response:** Proxied page content (passthrough).

**Error response (auth redirect detected, 200 with success: false):**
```json
{
  "data": {
    "redirect_url": "https://sso.tsmc.com/login"
  },
  "message": "Auth redirect detected — page requires login",
  "success": false
}
```

---

## 3.6 Static Files

FastAPI mounts the `frontend/` directory as StaticFiles at the root path `/`, serving `index.html` as the root. This is not a REST endpoint and does not go through the `/api/v1/` prefix. All SPA routing is handled client-side.

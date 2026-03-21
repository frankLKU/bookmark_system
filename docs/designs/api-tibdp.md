# API Interface Specification - TIBDP

> **Note:** The MVP is client-side only (Zustand + LocalStorage). These API specs define the contract for a future backend (e.g., multi-device sync, team sharing). All endpoints follow the project convention: prefix `/api/v1/`, standard response format.

## Base URL

```
/api/v1/
```

## Standard Response Format

All responses follow this structure:

```json
{
  "data": <any>,
  "message": "<string>",
  "success": <boolean>
}
```

## Data Types

### FactoryTag

```typescript
type FactoryTag = 'f12' | 'f14a' | 'f14b' | 'f15a' | 'f15b' | 'f16' | 'f18' | 'f18b' | 'f20' | 'f21' | 'f22' | 'f23' | 'foc' | 'ftest' | 'ftestdev';
```

### Bookmark (API representation)

```json
{
  "id": "uuid-string",
  "title": "string",
  "url": "string",
  "category_id": "uuid-string",
  "tags": ["f18", "f14a"],
  "is_combined": false,
  "last_accessed": 1711036800,
  "is_healthy": true,
  "health_checked_at": "2026-03-21T00:00:00Z",
  "created_at": "2026-03-21T00:00:00Z",
  "updated_at": "2026-03-21T00:00:00Z"
}
```

### Category (API representation)

```json
{
  "id": "uuid-string",
  "name": "string",
  "order": 0,
  "bookmark_count": 15,
  "created_at": "2026-03-21T00:00:00Z",
  "updated_at": "2026-03-21T00:00:00Z"
}
```

---

## Endpoints

### Bookmarks

#### GET /api/v1/bookmarks

List all bookmarks with optional filtering.

**Query Parameters:**

| Parameter   | Type   | Required | Description |
|-------------|--------|----------|-------------|
| category_id | string | No       | Filter by category UUID |
| tag         | string | No       | Filter by factory tag (e.g., `f18`). Multiple allowed: `?tag=f18&tag=f14a` |
| search      | string | No       | Fuzzy search in title and tags |
| page        | int    | No       | Page number (default: 1) |
| per_page    | int    | No       | Items per page (default: 50, max: 200) |

**Response (200):**

```json
{
  "data": {
    "items": [
      {
        "id": "b1a2c3d4-...",
        "title": "Spark F18 Dashboard",
        "url": "https://spark-f18.tsmc.com",
        "category_id": "cat-uuid-1",
        "tags": ["f18"],
        "is_combined": true,
        "last_accessed": 1711036800,
        "is_healthy": true,
        "health_checked_at": "2026-03-21T10:00:00Z",
        "created_at": "2026-03-21T00:00:00Z",
        "updated_at": "2026-03-21T00:00:00Z"
      }
    ],
    "total": 120,
    "page": 1,
    "per_page": 50
  },
  "message": "Bookmarks retrieved successfully",
  "success": true
}
```

---

#### POST /api/v1/bookmarks

Create a new bookmark.

**Request Body:**

```json
{
  "title": "Spark F18 Dashboard",
  "url": "https://spark-f18.tsmc.com",
  "category_id": "cat-uuid-1",
  "tags": ["f18"],
  "is_combined": false
}
```

| Field       | Type     | Required | Description |
|-------------|----------|----------|-------------|
| title       | string   | Yes      | Display name, max 100 chars |
| url         | string   | Yes      | Valid URL |
| category_id | string   | No       | Category UUID. Null = uncategorized |
| tags        | string[] | No       | Array of FactoryTag values. Default: [] |
| is_combined | boolean  | No       | Default: false |

**Response (201):**

```json
{
  "data": {
    "id": "b1a2c3d4-...",
    "title": "Spark F18 Dashboard",
    "url": "https://spark-f18.tsmc.com",
    "category_id": "cat-uuid-1",
    "tags": ["f18"],
    "is_combined": false,
    "last_accessed": 0,
    "is_healthy": null,
    "health_checked_at": null,
    "created_at": "2026-03-21T00:00:00Z",
    "updated_at": "2026-03-21T00:00:00Z"
  },
  "message": "Bookmark created successfully",
  "success": true
}
```

---

#### PUT /api/v1/bookmarks/{id}

Update an existing bookmark.

**Path Parameters:**

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| id        | string | Yes      | Bookmark UUID |

**Request Body:** (all fields optional, only provided fields are updated)

```json
{
  "title": "Updated Title",
  "url": "https://spark-f18.tsmc.com",
  "category_id": "cat-uuid-2",
  "tags": ["f18", "f14a"],
  "is_combined": true
}
```

**Response (200):** Returns the full updated bookmark object in `data`.

---

#### DELETE /api/v1/bookmarks/{id}

Delete a bookmark.

**Path Parameters:**

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| id        | string | Yes      | Bookmark UUID |

**Response (200):**

```json
{
  "data": null,
  "message": "Bookmark deleted successfully",
  "success": true
}
```

---

#### POST /api/v1/bookmarks/{id}/access

Record that a bookmark was accessed (updates `last_accessed` timestamp).

**Path Parameters:**

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| id        | string | Yes      | Bookmark UUID |

**Response (200):**

```json
{
  "data": {
    "id": "b1a2c3d4-...",
    "last_accessed": 1711036800
  },
  "message": "Access recorded",
  "success": true
}
```

---

### Health Check

#### POST /api/v1/bookmarks/health-check

Trigger a health check for all bookmarks (or a subset). Returns reachability status.

**Request Body (optional):**

```json
{
  "bookmark_ids": ["b1a2c3d4-...", "e5f6g7h8-..."]
}
```

If `bookmark_ids` is omitted, all bookmarks are checked.

**Response (200):**

```json
{
  "data": {
    "results": [
      {
        "id": "b1a2c3d4-...",
        "url": "https://spark-f18.tsmc.com",
        "is_healthy": true,
        "status_code": 200,
        "checked_at": "2026-03-21T10:05:00Z"
      },
      {
        "id": "e5f6g7h8-...",
        "url": "https://old-tool.tsmc.com",
        "is_healthy": false,
        "status_code": 503,
        "checked_at": "2026-03-21T10:05:00Z"
      }
    ],
    "checked_count": 2
  },
  "message": "Health check completed",
  "success": true
}
```

---

### Categories

#### GET /api/v1/categories

List all categories, ordered by `order` field.

**Response (200):**

```json
{
  "data": [
    {
      "id": "cat-uuid-1",
      "name": "Monitoring",
      "order": 0,
      "bookmark_count": 15,
      "created_at": "2026-03-21T00:00:00Z",
      "updated_at": "2026-03-21T00:00:00Z"
    },
    {
      "id": "cat-uuid-2",
      "name": "Data Pipeline",
      "order": 1,
      "bookmark_count": 8,
      "created_at": "2026-03-21T00:00:00Z",
      "updated_at": "2026-03-21T00:00:00Z"
    }
  ],
  "message": "Categories retrieved successfully",
  "success": true
}
```

---

#### POST /api/v1/categories

Create a new category.

**Request Body:**

```json
{
  "name": "Spark",
  "order": 2
}
```

| Field | Type   | Required | Description |
|-------|--------|----------|-------------|
| name  | string | Yes      | Category name, unique |
| order | int    | No       | Display order. Default: appended at end |

**Response (201):** Returns the full category object in `data`.

---

#### PUT /api/v1/categories/{id}

Update a category (rename or reorder).

**Path Parameters:**

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| id        | string | Yes      | Category UUID |

**Request Body:**

```json
{
  "name": "Updated Name",
  "order": 0
}
```

**Response (200):** Returns the full updated category object in `data`.

---

#### PUT /api/v1/categories/reorder

Batch reorder categories.

**Request Body:**

```json
{
  "order": ["cat-uuid-3", "cat-uuid-1", "cat-uuid-2"]
}
```

Array of category IDs in desired display order. Each category's `order` field is updated to match its array index.

**Response (200):**

```json
{
  "data": null,
  "message": "Categories reordered successfully",
  "success": true
}
```

---

#### DELETE /api/v1/categories/{id}

Delete a category. Bookmarks in this category will have their `category_id` set to `null` (uncategorized).

**Path Parameters:**

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| id        | string | Yes      | Category UUID |

**Response (200):**

```json
{
  "data": {
    "affected_bookmarks": 8
  },
  "message": "Category deleted successfully",
  "success": true
}
```

---

### Import / Export

#### POST /api/v1/import/onetab

Import bookmarks from OneTab format text.

**Request Body:**

```json
{
  "content": "https://spark-f18.tsmc.com | Spark F18\nhttps://airflow-f18.tsmc.com | Airflow F18\nhttps://grafana-f14a.tsmc.com"
}
```

| Field   | Type   | Required | Description |
|---------|--------|----------|-------------|
| content | string | Yes      | Raw OneTab export text. Format: `URL | Title` per line, or just `URL` |

**Response (200):** Returns parsed preview (not yet saved). User must confirm via `POST /api/v1/import/confirm`.

```json
{
  "data": {
    "parsed": [
      {
        "title": "Spark F18",
        "url": "https://spark-f18.tsmc.com",
        "tags": ["f18"],
        "category": "Spark",
        "auto_detected": true
      },
      {
        "title": "Airflow F18",
        "url": "https://airflow-f18.tsmc.com",
        "tags": ["f18"],
        "category": "Airflow",
        "auto_detected": true
      },
      {
        "title": "grafana-f14a.tsmc.com",
        "url": "https://grafana-f14a.tsmc.com",
        "tags": ["f14a"],
        "category": "Monitoring",
        "auto_detected": true
      }
    ],
    "parse_token": "temp-token-abc123"
  },
  "message": "3 bookmarks parsed successfully",
  "success": true
}
```

**Auto-detection rules:**
- Factory tags: regex `f\d+[a-z]?` in URL hostname (e.g., `spark-f18.tsmc.com` -> `f18`)
- Category: URL keyword mapping: `spark` -> "Spark", `airflow` -> "Airflow", `grafana` -> "Monitoring"
- Title: Uses provided title, or falls back to hostname

---

#### POST /api/v1/import/confirm

Confirm and save parsed bookmarks (after user review/edit).

**Request Body:**

```json
{
  "bookmarks": [
    {
      "title": "Spark F18",
      "url": "https://spark-f18.tsmc.com",
      "tags": ["f18"],
      "category_id": "cat-uuid-1"
    },
    {
      "title": "Airflow F18 (renamed)",
      "url": "https://airflow-f18.tsmc.com",
      "tags": ["f18"],
      "category_id": "cat-uuid-2"
    }
  ]
}
```

**Response (201):**

```json
{
  "data": {
    "imported_count": 2,
    "bookmarks": [ /* full bookmark objects */ ]
  },
  "message": "2 bookmarks imported successfully",
  "success": true
}
```

---

#### GET /api/v1/export

Export all bookmarks and categories as JSON backup.

**Query Parameters:**

| Parameter   | Type   | Required | Description |
|-------------|--------|----------|-------------|
| category_id | string | No       | Export only bookmarks in this category |

**Response (200):**

```json
{
  "data": {
    "exported_at": "2026-03-21T10:00:00Z",
    "version": "1.0",
    "categories": [
      {
        "id": "cat-uuid-1",
        "name": "Monitoring",
        "order": 0
      }
    ],
    "bookmarks": [
      {
        "id": "b1a2c3d4-...",
        "title": "Spark F18 Dashboard",
        "url": "https://spark-f18.tsmc.com",
        "category_id": "cat-uuid-1",
        "tags": ["f18"],
        "is_combined": true,
        "last_accessed": 1711036800
      }
    ],
    "total_bookmarks": 50,
    "total_categories": 5
  },
  "message": "Export completed successfully",
  "success": true
}
```

#### POST /api/v1/import/json

Restore from a previously exported JSON backup.

**Request Body:** The full export JSON object (same structure as GET /api/v1/export response `data`).

**Response (201):**

```json
{
  "data": {
    "imported_bookmarks": 50,
    "imported_categories": 5
  },
  "message": "Backup restored successfully",
  "success": true
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
| 400 | Bad Request - validation error (missing required fields, invalid URL format, invalid FactoryTag) |
| 404 | Not Found - bookmark or category UUID does not exist |
| 409 | Conflict - duplicate URL on bookmark creation, duplicate category name |
| 422 | Unprocessable Entity - valid JSON but semantically invalid |
| 500 | Internal Server Error |

---

## Frontend-Backend Interface Mapping

For MVP, the frontend Zustand store implements these operations client-side. When migrating to a backend:

| Zustand Action | API Endpoint |
|----------------|-------------|
| `addBookmark()` | POST /api/v1/bookmarks |
| `updateBookmark()` | PUT /api/v1/bookmarks/{id} |
| `deleteBookmark()` | DELETE /api/v1/bookmarks/{id} |
| `addCategory()` | POST /api/v1/categories |
| `updateCategory()` | PUT /api/v1/categories/{id} |
| `deleteCategory()` | DELETE /api/v1/categories/{id} |
| `reorderCategories()` | PUT /api/v1/categories/reorder |
| `importBookmarks()` | POST /api/v1/import/onetab + POST /api/v1/import/confirm |
| `exportToJSON()` | GET /api/v1/export |
| Health check interval | POST /api/v1/bookmarks/health-check |
| Tab open tracking | POST /api/v1/bookmarks/{id}/access |

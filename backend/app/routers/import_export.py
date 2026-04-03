import json
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends
from typing import Any

from app.models import ImportOnetabRequest, ImportConfirmRequest
from app.database import get_db

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


# --- Auto-detection helpers ---

CATEGORY_KEYWORDS = {
    "spark": "Spark",
    "airflow": "Airflow",
    "grafana": "Monitoring",
    "jenkins": "CI/CD",
    "jira": "Project Management",
}

FACTORY_TAG_RE = re.compile(r"f\d+[a-z]?", re.IGNORECASE)


def _detect_factory_tags(url: str, title: str = "") -> list[str]:
    """Extract factory identifiers like f18, f12, f14a from URL and title."""
    hostname = urlparse(url).hostname or url
    # Search in both hostname and title
    text = f"{hostname} {title}"
    matches = FACTORY_TAG_RE.findall(text)
    # Deduplicate while preserving order
    seen = set()
    result = []
    for m in matches:
        lower = m.lower()
        if lower not in seen:
            seen.add(lower)
            result.append(lower)
    return result


def _detect_category(url: str) -> str:
    """Detect category name from URL keywords."""
    url_lower = url.lower()
    for keyword, category in CATEGORY_KEYWORDS.items():
        if keyword in url_lower:
            return category
    return ""


def _derive_title(url: str) -> str:
    """Derive a human-readable title from a URL when none is provided."""
    parsed = urlparse(url)
    hostname = parsed.hostname or url
    # Strip www. prefix
    if hostname.startswith("www."):
        hostname = hostname[4:]
    return hostname


def _parse_onetab_line(line: str, temp_id: int) -> dict | None:
    """Parse a single OneTab line into a preview item."""
    line = line.strip()
    if not line:
        return None

    if "|" in line:
        parts = line.split("|", 1)
        url = parts[0].strip()
        title = parts[1].strip()
    else:
        url = line
        title = ""

    if not url:
        return None

    if not title:
        title = _derive_title(url)

    tags = _detect_factory_tags(url, title)
    category = _detect_category(url)

    return {
        "temp_id": temp_id,
        "title": title,
        "url": url,
        "tags": tags,
        "category": category,
    }


def _get_or_create_category(db, name: str) -> str | None:
    """Return category id for given name, creating it if needed. Returns None for empty name."""
    if not name:
        return None
    row = db.execute("SELECT id FROM categories WHERE name = ?", (name,)).fetchone()
    if row:
        return row["id"]
    # Create new category
    cid = str(uuid.uuid4())
    now = _now()
    # Determine next display_order
    max_order = db.execute("SELECT COALESCE(MAX(display_order), 0) FROM categories").fetchone()[0]
    db.execute(
        "INSERT INTO categories (id, name, display_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (cid, name, max_order + 1, now, now),
    )
    db.commit()
    return cid


# --- Endpoints ---

@router.post("/import/onetab")
def import_onetab_preview(request: ImportOnetabRequest):
    """Parse OneTab text format and return a preview without saving."""
    content = request.content.strip()
    if not content:
        return {"data": {"preview": []}, "message": "Nothing to preview", "success": True}

    lines = content.splitlines()
    preview = []
    for i, line in enumerate(lines):
        item = _parse_onetab_line(line, temp_id=i + 1)
        if item:
            preview.append(item)

    return {
        "data": {"preview": preview},
        "message": f"{len(preview)} bookmarks parsed",
        "success": True,
    }


@router.post("/import/confirm", status_code=201)
def import_confirm(request: ImportConfirmRequest, db=Depends(get_db)):
    """Save parsed bookmarks to the database, auto-creating categories as needed."""
    imported = 0
    for item in request.bookmarks:
        category_id = _get_or_create_category(db, item.category)
        bid = str(uuid.uuid4())
        now = _now()
        db.execute(
            "INSERT INTO bookmarks (id, title, url, category_id, tags, is_combined, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (bid, item.title, item.url, category_id, json.dumps(item.tags), 0, now, now),
        )
        imported += 1

    if imported:
        db.commit()

    return {
        "data": {"imported_count": imported},
        "message": f"{imported} bookmarks imported successfully",
        "success": True,
    }


@router.get("/export")
def export_bookmarks(db=Depends(get_db)):
    """Export all bookmarks grouped by category."""
    # Fetch all categories
    cat_rows = db.execute(
        "SELECT id, name, display_order, created_at, updated_at FROM categories ORDER BY display_order, name"
    ).fetchall()

    # Fetch all bookmarks with category info
    bm_rows = db.execute(
        "SELECT b.*, c.name as category_name FROM bookmarks b "
        "LEFT JOIN categories c ON b.category_id = c.id "
        "ORDER BY b.created_at ASC"
    ).fetchall()

    def _bm_dict(r) -> dict:
        return {
            "id": r["id"],
            "title": r["title"],
            "url": r["url"],
            "category_id": r["category_id"],
            "category_name": r["category_name"],
            "tags": json.loads(r["tags"]),
            "is_combined": bool(r["is_combined"]),
            "last_accessed": r["last_accessed"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
        }

    # Build categories map
    cat_map: dict[str, dict] = {}
    for c in cat_rows:
        cat_map[c["id"]] = {
            "id": c["id"],
            "name": c["name"],
            "bookmarks": [],
        }

    # Bucket for uncategorized
    uncategorized: list[dict] = []

    total = 0
    for bm in bm_rows:
        bm_data = _bm_dict(bm)
        total += 1
        if bm["category_id"] and bm["category_id"] in cat_map:
            cat_map[bm["category_id"]]["bookmarks"].append(bm_data)
        else:
            uncategorized.append(bm_data)

    categories = list(cat_map.values())
    if uncategorized:
        categories.append({"id": None, "name": "Uncategorized", "bookmarks": uncategorized})

    # Only include categories that have bookmarks
    categories = [c for c in categories if c["bookmarks"]]

    return {
        "data": {
            "exported_at": _now(),
            "total": total,
            "categories": categories,
        },
        "message": "Export completed successfully",
        "success": True,
    }


@router.post("/import/json", status_code=201)
def import_json(payload: dict[str, Any], db=Depends(get_db)):
    """Restore bookmarks from the export JSON format."""
    categories_data = payload.get("categories", [])
    imported = 0

    for cat in categories_data:
        cat_name = cat.get("name", "")
        # Skip the synthetic "Uncategorized" bucket — those bookmarks have no category
        if cat_name == "Uncategorized":
            category_id = None
        else:
            category_id = _get_or_create_category(db, cat_name) if cat_name else None

        for bm in cat.get("bookmarks", []):
            bid = str(uuid.uuid4())
            now = _now()
            tags = bm.get("tags", [])
            is_combined = int(bm.get("is_combined", False))
            db.execute(
                "INSERT INTO bookmarks (id, title, url, category_id, tags, is_combined, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (bid, bm["title"], bm["url"], category_id, json.dumps(tags), is_combined, now, now),
            )
            imported += 1

    if imported:
        db.commit()

    return {
        "data": {"imported_count": imported},
        "message": f"{imported} bookmarks imported successfully",
        "success": True,
    }

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

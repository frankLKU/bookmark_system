import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from app.models import CategoryCreate, CategoryUpdate, CategoryReorder
from app.database import get_db

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("/categories")
def list_categories(db=Depends(get_db)):
    rows = db.execute(
        """
        SELECT c.*, COUNT(b.id) as bookmark_count
        FROM categories c
        LEFT JOIN bookmarks b ON b.category_id = c.id
        GROUP BY c.id
        ORDER BY c.display_order ASC, c.created_at ASC
        """
    ).fetchall()
    items = [
        {
            "id": r["id"], "name": r["name"], "display_order": r["display_order"],
            "bookmark_count": r["bookmark_count"],
            "created_at": r["created_at"], "updated_at": r["updated_at"],
        }
        for r in rows
    ]
    return {"data": items, "message": "Categories retrieved successfully", "success": True}


@router.post("/categories", status_code=201)
def create_category(category: CategoryCreate, db=Depends(get_db)):
    cid = str(uuid.uuid4())
    now = _now()
    try:
        db.execute(
            "INSERT INTO categories (id, name, display_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (cid, category.name, 0, now, now),
        )
        db.commit()
    except Exception as e:
        if "UNIQUE" in str(e):
            raise HTTPException(409, detail="Category name already exists")
        raise
    row = db.execute("SELECT * FROM categories WHERE id = ?", (cid,)).fetchone()
    return {
        "data": {
            "id": row["id"], "name": row["name"], "display_order": row["display_order"],
            "bookmark_count": 0,
            "created_at": row["created_at"], "updated_at": row["updated_at"],
        },
        "message": "Category created successfully", "success": True,
    }


@router.put("/categories/reorder")
def reorder_categories(body: CategoryReorder, db=Depends(get_db)):
    for idx, cat_id in enumerate(body.order):
        db.execute("UPDATE categories SET display_order = ?, updated_at = ? WHERE id = ?", (idx, _now(), cat_id))
    db.commit()
    return {"data": None, "message": "Categories reordered successfully", "success": True}


@router.put("/categories/{category_id}")
def update_category(category_id: str, category: CategoryUpdate, db=Depends(get_db)):
    existing = db.execute("SELECT id FROM categories WHERE id = ?", (category_id,)).fetchone()
    if not existing:
        raise HTTPException(404, detail="Category not found")

    updates = []
    params = []
    if category.name is not None:
        updates.append("name = ?"); params.append(category.name)

    if updates:
        updates.append("updated_at = ?"); params.append(_now())
        params.append(category_id)
        db.execute(f"UPDATE categories SET {', '.join(updates)} WHERE id = ?", params)
        db.commit()

    row = db.execute("SELECT * FROM categories WHERE id = ?", (category_id,)).fetchone()
    count = db.execute("SELECT COUNT(*) FROM bookmarks WHERE category_id = ?", (category_id,)).fetchone()[0]
    return {
        "data": {
            "id": row["id"], "name": row["name"], "display_order": row["display_order"],
            "created_at": row["created_at"], "updated_at": row["updated_at"],
            "bookmark_count": count,
        },
        "message": "Category updated successfully", "success": True,
    }


@router.delete("/categories/{category_id}")
def delete_category(category_id: str, db=Depends(get_db)):
    existing = db.execute("SELECT id FROM categories WHERE id = ?", (category_id,)).fetchone()
    if not existing:
        raise HTTPException(404, detail="Category not found")
    db.execute("UPDATE bookmarks SET category_id = NULL WHERE category_id = ?", (category_id,))
    db.execute("DELETE FROM categories WHERE id = ?", (category_id,))
    db.commit()
    return {"data": None, "message": "Category deleted successfully", "success": True}

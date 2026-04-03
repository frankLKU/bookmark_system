from datetime import datetime, timezone
from fastapi import APIRouter, Depends
import httpx

from app.database import get_db

router = APIRouter()


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.post("/health/check")
def trigger_health_check(db=Depends(get_db)):
    bookmarks = db.execute("SELECT id, url FROM bookmarks").fetchall()
    checked = 0
    with httpx.Client(timeout=10, verify=False) as client:
        for bookmark in bookmarks:
            try:
                resp = client.head(bookmark["url"])
                is_healthy = 200 <= resp.status_code < 400
                status_code = resp.status_code
            except Exception:
                is_healthy = False
                status_code = 0
            db.execute(
                "INSERT INTO health_checks (bookmark_id, is_healthy, status_code, checked_at) VALUES (?, ?, ?, ?)",
                (bookmark["id"], int(is_healthy), status_code, _now()),
            )
            checked += 1
    db.commit()
    return {"data": {"checked": checked}, "message": f"{checked} bookmarks checked", "success": True}


@router.get("/health/status")
def get_health_status(db=Depends(get_db)):
    rows = db.execute("""
        SELECT h.bookmark_id, h.is_healthy, h.status_code, h.checked_at
        FROM health_checks h
        INNER JOIN (
            SELECT bookmark_id, MAX(id) as max_id
            FROM health_checks
            GROUP BY bookmark_id
        ) latest ON h.id = latest.max_id
    """).fetchall()
    items = [
        {
            "bookmark_id": r["bookmark_id"],
            "is_healthy": bool(r["is_healthy"]),
            "status_code": r["status_code"],
            "checked_at": r["checked_at"],
        }
        for r in rows
    ]
    return {"data": items, "message": "Health status retrieved", "success": True}

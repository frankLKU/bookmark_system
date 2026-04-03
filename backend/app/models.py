from pydantic import BaseModel
from typing import Any, Optional


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

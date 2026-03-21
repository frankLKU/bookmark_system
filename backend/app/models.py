from pydantic import BaseModel, HttpUrl
from typing import Optional
from datetime import datetime


class BookmarkBase(BaseModel):
    title: str
    url: str
    description: str = ""
    category_id: Optional[int] = None


class BookmarkCreate(BookmarkBase):
    pass


class BookmarkUpdate(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None


class BookmarkResponse(BookmarkBase):
    id: int
    is_healthy: Optional[bool] = None
    created_at: datetime
    updated_at: datetime


class HealthCheckResponse(BaseModel):
    id: int
    url: str
    is_healthy: bool
    status_code: int
    checked_at: datetime


class CategoryBase(BaseModel):
    name: str


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None


class CategoryResponse(CategoryBase):
    id: int
    bookmark_count: int = 0
    created_at: datetime
    updated_at: datetime


class ImportRequest(BaseModel):
    content: str
    category_id: Optional[int] = None


class ImportBookmarkItem(BaseModel):
    id: int
    title: str
    url: str
    category_id: Optional[int] = None


class ImportResponse(BaseModel):
    imported_count: int
    bookmarks: list[ImportBookmarkItem]


class ExportCategory(BaseModel):
    id: int
    name: str
    bookmarks: list[BookmarkResponse]


class ExportResponse(BaseModel):
    exported_at: datetime
    total: int
    categories: list[ExportCategory]


class PaginatedBookmarks(BaseModel):
    items: list[BookmarkResponse]
    total: int
    page: int
    per_page: int


class APIResponse(BaseModel):
    data: object = None
    message: str = ""
    success: bool = True

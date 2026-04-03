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

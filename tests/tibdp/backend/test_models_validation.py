import pytest
from pydantic import ValidationError

from app.models import (
    BookmarkCreate,
    BookmarkUpdate,
    CategoryCreate,
    CategoryUpdate,
    ImportRequest,
)


class TestBookmarkCreate:
    def test_valid_bookmark(self):
        b = BookmarkCreate(title="Spark F18", url="https://spark-f18.tsmc.com")
        assert b.title == "Spark F18"
        assert b.url == "https://spark-f18.tsmc.com"
        assert b.description == ""
        assert b.category_id is None

    def test_with_all_fields(self):
        b = BookmarkCreate(
            title="Spark F18",
            url="https://spark-f18.tsmc.com",
            description="Spark dashboard",
            category_id=1,
        )
        assert b.description == "Spark dashboard"
        assert b.category_id == 1

    def test_missing_title_raises(self):
        with pytest.raises(ValidationError):
            BookmarkCreate(url="https://spark-f18.tsmc.com")

    def test_missing_url_raises(self):
        with pytest.raises(ValidationError):
            BookmarkCreate(title="Spark F18")

    def test_empty_title_is_valid(self):
        b = BookmarkCreate(title="", url="https://spark.com")
        assert b.title == ""

    def test_empty_url_is_valid(self):
        b = BookmarkCreate(title="Test", url="")
        assert b.url == ""


class TestBookmarkUpdate:
    def test_all_fields_optional(self):
        b = BookmarkUpdate()
        assert b.title is None
        assert b.url is None
        assert b.description is None
        assert b.category_id is None

    def test_partial_update(self):
        b = BookmarkUpdate(title="New Title")
        assert b.title == "New Title"
        assert b.url is None


class TestCategoryCreate:
    def test_valid_category(self):
        c = CategoryCreate(name="Monitoring")
        assert c.name == "Monitoring"

    def test_missing_name_raises(self):
        with pytest.raises(ValidationError):
            CategoryCreate()


class TestCategoryUpdate:
    def test_all_fields_optional(self):
        c = CategoryUpdate()
        assert c.name is None

    def test_with_name(self):
        c = CategoryUpdate(name="Updated")
        assert c.name == "Updated"


class TestImportRequest:
    def test_valid_import(self):
        r = ImportRequest(content="https://spark.com | Spark")
        assert r.content == "https://spark.com | Spark"
        assert r.category_id is None

    def test_with_category(self):
        r = ImportRequest(content="https://spark.com | Spark", category_id=1)
        assert r.category_id == 1

    def test_missing_content_raises(self):
        with pytest.raises(ValidationError):
            ImportRequest()

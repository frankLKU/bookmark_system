import pytest


class TestListBookmarks:
    def test_list_bookmarks_returns_success(self, client):
        response = client.get("/api/v1/bookmarks")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "data" in data
        assert "items" in data["data"]

    def test_list_bookmarks_with_pagination(self, client):
        response = client.get("/api/v1/bookmarks?page=1&per_page=10")
        assert response.status_code == 200
        data = response.json()
        assert data["data"]["page"] == 1
        assert data["data"]["per_page"] == 10

    def test_list_bookmarks_invalid_page(self, client):
        response = client.get("/api/v1/bookmarks?page=0")
        assert response.status_code == 422

    def test_list_bookmarks_per_page_exceeds_max(self, client):
        response = client.get("/api/v1/bookmarks?per_page=101")
        assert response.status_code == 422

    def test_list_bookmarks_with_category_filter(self, client):
        response = client.get("/api/v1/bookmarks?category_id=1")
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_list_bookmarks_with_search(self, client):
        response = client.get("/api/v1/bookmarks?search=spark")
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestCreateBookmark:
    def test_create_bookmark_returns_201(self, client):
        response = client.post("/api/v1/bookmarks", json={
            "title": "Spark F18",
            "url": "https://spark-f18.tsmc.com",
        })
        assert response.status_code == 201
        assert response.json()["success"] is True

    def test_create_bookmark_with_category(self, client):
        response = client.post("/api/v1/bookmarks", json={
            "title": "Spark F18",
            "url": "https://spark-f18.tsmc.com",
            "category_id": 1,
        })
        assert response.status_code == 201

    def test_create_bookmark_with_description(self, client):
        response = client.post("/api/v1/bookmarks", json={
            "title": "Spark F18",
            "url": "https://spark-f18.tsmc.com",
            "description": "Spark dashboard for F18 factory",
        })
        assert response.status_code == 201

    def test_create_bookmark_missing_title(self, client):
        response = client.post("/api/v1/bookmarks", json={
            "url": "https://spark-f18.tsmc.com",
        })
        assert response.status_code == 422

    def test_create_bookmark_missing_url(self, client):
        response = client.post("/api/v1/bookmarks", json={
            "title": "Spark F18",
        })
        assert response.status_code == 422

    def test_create_bookmark_empty_body(self, client):
        response = client.post("/api/v1/bookmarks", json={})
        assert response.status_code == 422


class TestUpdateBookmark:
    def test_update_bookmark_returns_success(self, client):
        response = client.put("/api/v1/bookmarks/1", json={
            "title": "Updated Title",
        })
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_update_bookmark_partial_fields(self, client):
        response = client.put("/api/v1/bookmarks/1", json={
            "url": "https://new-url.tsmc.com",
        })
        assert response.status_code == 200

    def test_update_bookmark_empty_body_is_valid(self, client):
        response = client.put("/api/v1/bookmarks/1", json={})
        assert response.status_code == 200


class TestDeleteBookmark:
    def test_delete_bookmark_returns_success(self, client):
        response = client.delete("/api/v1/bookmarks/1")
        assert response.status_code == 200
        assert response.json()["success"] is True


class TestBookmarkHealth:
    def test_health_check_returns_success(self, client):
        response = client.get("/api/v1/bookmarks/1/health")
        assert response.status_code == 200
        assert response.json()["success"] is True

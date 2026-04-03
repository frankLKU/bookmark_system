class TestListBookmarks:
    def test_empty_list(self, client):
        resp = client.get("/api/v1/bookmarks")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["data"]["items"] == []
        assert data["data"]["total"] == 0

    def test_with_data(self, client, seed_bookmark):
        resp = client.get("/api/v1/bookmarks")
        assert resp.json()["data"]["total"] == 1
        assert resp.json()["data"]["items"][0]["title"] == "Spark F18"

    def test_pagination(self, client):
        resp = client.get("/api/v1/bookmarks?page=1&per_page=5")
        assert resp.json()["data"]["page"] == 1
        assert resp.json()["data"]["per_page"] == 5

    def test_search_filter(self, client, seed_bookmark):
        resp = client.get("/api/v1/bookmarks?search=spark")
        assert resp.json()["data"]["total"] == 1

    def test_search_no_match(self, client, seed_bookmark):
        resp = client.get("/api/v1/bookmarks?search=grafana")
        assert resp.json()["data"]["total"] == 0

    def test_tag_filter(self, client, seed_bookmark):
        resp = client.get("/api/v1/bookmarks?tag=f18")
        assert resp.json()["data"]["total"] == 1

    def test_tag_no_match(self, client, seed_bookmark):
        resp = client.get("/api/v1/bookmarks?tag=f12")
        assert resp.json()["data"]["total"] == 0

    def test_category_filter(self, client, seed_bookmark, seed_category):
        resp = client.get(f"/api/v1/bookmarks?category_id={seed_category}")
        assert resp.json()["data"]["total"] == 1

    def test_includes_category_name(self, client, seed_bookmark):
        resp = client.get("/api/v1/bookmarks")
        item = resp.json()["data"]["items"][0]
        assert item["category_name"] == "Spark"


class TestGetBookmark:
    def test_get_existing(self, client, seed_bookmark):
        resp = client.get(f"/api/v1/bookmarks/{seed_bookmark}")
        assert resp.status_code == 200
        assert resp.json()["data"]["id"] == seed_bookmark

    def test_get_nonexistent(self, client):
        resp = client.get("/api/v1/bookmarks/nonexistent-id")
        assert resp.status_code == 404


class TestCreateBookmark:
    def test_create_minimal(self, client):
        resp = client.post("/api/v1/bookmarks", json={
            "title": "Test", "url": "https://test.com"
        })
        assert resp.status_code == 201
        assert resp.json()["data"]["id"] is not None
        assert resp.json()["data"]["tags"] == []

    def test_create_with_tags(self, client):
        resp = client.post("/api/v1/bookmarks", json={
            "title": "Test", "url": "https://test.com", "tags": ["f18", "f14a"]
        })
        assert resp.json()["data"]["tags"] == ["f18", "f14a"]

    def test_create_missing_title(self, client):
        resp = client.post("/api/v1/bookmarks", json={"url": "https://test.com"})
        assert resp.status_code == 422


class TestUpdateBookmark:
    def test_update_title(self, client, seed_bookmark):
        resp = client.put(f"/api/v1/bookmarks/{seed_bookmark}", json={"title": "Updated"})
        assert resp.status_code == 200
        assert resp.json()["data"]["title"] == "Updated"

    def test_update_nonexistent(self, client):
        resp = client.put("/api/v1/bookmarks/fake-id", json={"title": "X"})
        assert resp.status_code == 404


class TestDeleteBookmark:
    def test_delete_existing(self, client, seed_bookmark):
        resp = client.delete(f"/api/v1/bookmarks/{seed_bookmark}")
        assert resp.status_code == 200
        resp2 = client.get(f"/api/v1/bookmarks/{seed_bookmark}")
        assert resp2.status_code == 404

    def test_delete_nonexistent(self, client):
        resp = client.delete("/api/v1/bookmarks/fake-id")
        assert resp.status_code == 404


class TestUpdateAccess:
    def test_update_last_accessed(self, client, seed_bookmark):
        resp = client.patch(f"/api/v1/bookmarks/{seed_bookmark}/access")
        assert resp.status_code == 200
        assert resp.json()["data"]["last_accessed"] is not None

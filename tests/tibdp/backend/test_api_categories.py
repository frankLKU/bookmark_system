class TestListCategories:
    def test_empty_list(self, client):
        resp = client.get("/api/v1/categories")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    def test_with_data(self, client, seed_category):
        resp = client.get("/api/v1/categories")
        assert len(resp.json()["data"]) == 1
        assert resp.json()["data"][0]["name"] == "Spark"

    def test_includes_bookmark_count(self, client, seed_bookmark):
        resp = client.get("/api/v1/categories")
        assert resp.json()["data"][0]["bookmark_count"] == 1


class TestCreateCategory:
    def test_create(self, client):
        resp = client.post("/api/v1/categories", json={"name": "Monitoring"})
        assert resp.status_code == 201
        assert resp.json()["data"]["name"] == "Monitoring"

    def test_duplicate_name(self, client, seed_category):
        resp = client.post("/api/v1/categories", json={"name": "Spark"})
        assert resp.status_code == 409

    def test_missing_name(self, client):
        resp = client.post("/api/v1/categories", json={})
        assert resp.status_code == 422


class TestUpdateCategory:
    def test_rename(self, client, seed_category):
        resp = client.put(f"/api/v1/categories/{seed_category}", json={"name": "Renamed"})
        assert resp.status_code == 200
        assert resp.json()["data"]["name"] == "Renamed"

    def test_nonexistent(self, client):
        resp = client.put("/api/v1/categories/fake-id", json={"name": "X"})
        assert resp.status_code == 404


class TestDeleteCategory:
    def test_delete(self, client, seed_category):
        resp = client.delete(f"/api/v1/categories/{seed_category}")
        assert resp.status_code == 200

    def test_bookmarks_become_uncategorized(self, client, seed_bookmark, seed_category):
        client.delete(f"/api/v1/categories/{seed_category}")
        resp = client.get(f"/api/v1/bookmarks/{seed_bookmark}")
        assert resp.json()["data"]["category_id"] is None

    def test_nonexistent(self, client):
        resp = client.delete("/api/v1/categories/fake-id")
        assert resp.status_code == 404


class TestReorderCategories:
    def test_reorder(self, client):
        r1 = client.post("/api/v1/categories", json={"name": "A"})
        r2 = client.post("/api/v1/categories", json={"name": "B"})
        id_a = r1.json()["data"]["id"]
        id_b = r2.json()["data"]["id"]
        resp = client.put("/api/v1/categories/reorder", json={"order": [id_b, id_a]})
        assert resp.status_code == 200
        cats = client.get("/api/v1/categories").json()["data"]
        assert cats[0]["name"] == "B"
        assert cats[1]["name"] == "A"

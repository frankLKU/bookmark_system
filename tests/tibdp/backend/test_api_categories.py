import pytest


class TestListCategories:
    def test_list_categories_returns_success(self, client):
        response = client.get("/api/v1/categories")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["data"], list)


class TestCreateCategory:
    def test_create_category_returns_201(self, client):
        response = client.post("/api/v1/categories", json={
            "name": "Monitoring",
        })
        assert response.status_code == 201
        assert response.json()["success"] is True

    def test_create_category_missing_name(self, client):
        response = client.post("/api/v1/categories", json={})
        assert response.status_code == 422


class TestUpdateCategory:
    def test_update_category_returns_success(self, client):
        response = client.put("/api/v1/categories/1", json={
            "name": "Updated Name",
        })
        assert response.status_code == 200
        assert response.json()["success"] is True

    def test_update_category_empty_body_is_valid(self, client):
        response = client.put("/api/v1/categories/1", json={})
        assert response.status_code == 200


class TestDeleteCategory:
    def test_delete_category_returns_success(self, client):
        response = client.delete("/api/v1/categories/1")
        assert response.status_code == 200
        assert response.json()["success"] is True

from fastapi import APIRouter
from typing import Optional

from app.models import CategoryCreate, CategoryUpdate

router = APIRouter()


@router.get("/categories")
def list_categories():
    # TODO: implement with database
    return {"data": [], "message": "Categories retrieved successfully", "success": True}


@router.post("/categories", status_code=201)
def create_category(category: CategoryCreate):
    # TODO: implement with database
    return {"data": None, "message": "Category created successfully", "success": True}


@router.put("/categories/{category_id}")
def update_category(category_id: int, category: CategoryUpdate):
    # TODO: implement with database
    return {"data": None, "message": "Category updated successfully", "success": True}


@router.delete("/categories/{category_id}")
def delete_category(category_id: int):
    # TODO: implement with database
    return {"data": None, "message": "Category deleted successfully", "success": True}

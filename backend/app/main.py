from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.database import init_db
from app.routers import bookmarks, categories, import_export


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="Bookmark System API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bookmarks.router, prefix="/api/v1", tags=["bookmarks"])
app.include_router(categories.router, prefix="/api/v1", tags=["categories"])
app.include_router(import_export.router, prefix="/api/v1", tags=["import_export"])
# Note: health and proxy routers will be added in Tasks 10 and 11 respectively


@app.get("/")
def root():
    return {"message": "Bookmark System API"}

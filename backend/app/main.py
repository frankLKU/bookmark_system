import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.database import init_db
from app.routers import bookmarks, categories, import_export, health, websocket


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
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(websocket.router, tags=["websocket"])



# Mount frontend static files (must be after API routes to avoid catching /api/* paths)
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend")
if os.path.isdir(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

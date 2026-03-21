from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import bookmarks, categories, import_export, proxy

app = FastAPI(title="Bookmark System API", version="1.0.0")

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
app.include_router(proxy.router, prefix="/api/v1", tags=["proxy"])


@app.get("/")
def root():
    return {"message": "Bookmark System API"}

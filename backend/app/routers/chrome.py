"""REST endpoints for Chrome browser control via Playwright.

Replaces the old websocket.py router. Same REST interface, but commands
go directly to ChromeBrowserManager instead of being forwarded via WebSocket.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.chrome_browser import ChromeBrowserManager

router = APIRouter()

# Lazy singleton — not started at import time. desktop_app.py calls
# browser_manager.start() after the server is ready. Tests can patch
# this module attribute without triggering a real Chromium launch.
browser_manager = ChromeBrowserManager()


# --- Request models ---

class OpenTabGroupRequest(BaseModel):
    tag: str
    urls: list[str]
    focusUrl: str | None = None


class OpenSingleTabRequest(BaseModel):
    url: str
    tag: str | None = None


class TabIdRequest(BaseModel):
    tabId: str


class TagRequest(BaseModel):
    tag: str


# --- Endpoints ---

@router.get("/chrome/tabs")
def get_chrome_tabs():
    return {
        "success": True,
        "data": {
            "connected": browser_manager.connected,
            "tabs": browser_manager.get_tabs(),
        },
        "message": "OK",
    }


@router.post("/chrome/open-tab-group")
def open_tab_group(req: OpenTabGroupRequest):
    if not browser_manager.connected:
        return {"success": False, "data": None, "message": "Browser not running"}
    browser_manager.open_tab_group(req.tag, req.urls, req.focusUrl)
    return {"success": True, "data": None, "message": "OK"}


@router.post("/chrome/open-single-tab")
def open_single_tab(req: OpenSingleTabRequest):
    if not browser_manager.connected:
        return {"success": False, "data": None, "message": "Browser not running"}
    browser_manager.open_single_tab(req.url, req.tag)
    return {"success": True, "data": None, "message": "OK"}


@router.post("/chrome/switch-tab")
def switch_tab(req: TabIdRequest):
    if not browser_manager.connected:
        return {"success": False, "data": None, "message": "Browser not running"}
    found = browser_manager.switch_tab(req.tabId)
    if not found:
        return {"success": False, "data": None, "message": "Tab not found"}
    return {"success": True, "data": None, "message": "OK"}


@router.post("/chrome/close-tab")
def close_tab(req: TabIdRequest):
    if not browser_manager.connected:
        return {"success": False, "data": None, "message": "Browser not running"}
    found = browser_manager.close_tab(req.tabId)
    if not found:
        return {"success": False, "data": None, "message": "Tab not found"}
    return {"success": True, "data": None, "message": "OK"}


@router.post("/chrome/close-group")
def close_group(req: TagRequest):
    if not browser_manager.connected:
        return {"success": False, "data": None, "message": "Browser not running"}
    found = browser_manager.close_group(req.tag)
    if not found:
        return {"success": False, "data": None, "message": "Group not found"}
    return {"success": True, "data": None, "message": "OK"}

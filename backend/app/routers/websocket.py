"""WebSocket endpoint for Chrome Extension communication."""

import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

logger = logging.getLogger(__name__)
ws_router = APIRouter()      # WebSocket — mounted without prefix
rest_router = APIRouter()    # REST — mounted with /api/v1 prefix


class ChromeConnectionManager:
    """Manages the single WebSocket connection to Chrome Extension."""

    def __init__(self):
        self._ws: WebSocket | None = None
        self._tabs: list[dict] = []
        self._on_focus_search = None  # callback
        self._ping_task: asyncio.Task | None = None

    @property
    def connected(self) -> bool:
        return self._ws is not None

    @property
    def tabs(self) -> list[dict]:
        return self._tabs

    async def connect(self, websocket: WebSocket):
        """Accept new connection, close previous if exists (single-client policy)."""
        if self._ws is not None:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._cancel_ping()
        self._ws = websocket
        self._start_ping()

    def disconnect(self):
        self._cancel_ping()
        self._ws = None

    def _start_ping(self):
        """Start periodic ping to keep WebSocket alive."""
        self._ping_task = asyncio.ensure_future(self._ping_loop())

    def _cancel_ping(self):
        if self._ping_task is not None:
            self._ping_task.cancel()
            self._ping_task = None

    async def _ping_loop(self):
        """Send ping every 15 seconds to keep connection alive."""
        try:
            while self._ws is not None:
                await asyncio.sleep(15)
                if self._ws is not None:
                    try:
                        await self._ws.send_json({"type": "ping"})
                    except Exception:
                        self.disconnect()
                        break
        except asyncio.CancelledError:
            pass

    async def send_command(self, cmd_type: str, data: dict):
        """Send a command to the Chrome Extension."""
        if self._ws is None:
            logger.warning("No Chrome Extension connected, cannot send: %s", cmd_type)
            return
        try:
            await self._ws.send_json({"type": cmd_type, "data": data})
        except Exception as e:
            logger.error("Failed to send command %s: %s", cmd_type, e)
            self.disconnect()

    def handle_tabs_updated(self, data: dict):
        self._tabs = data.get("tabs", [])

    def set_focus_callback(self, callback):
        self._on_focus_search = callback

    def fire_focus_callback(self):
        """Invoke the focus search callback if set."""
        if self._on_focus_search:
            self._on_focus_search()


chrome_manager = ChromeConnectionManager()


@ws_router.websocket("/ws/chrome")
async def chrome_websocket(websocket: WebSocket):
    await websocket.accept()
    await chrome_manager.connect(websocket)
    logger.info("Chrome Extension connected")

    try:
        while True:
            raw = await websocket.receive_text()

            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                logger.warning("Received non-JSON frame, skipping: %s", raw[:120])
                continue

            msg_type = msg.get("type")

            if msg_type == "tabs_updated":
                chrome_manager.handle_tabs_updated(msg.get("data", {}))

            elif msg_type == "focus_search":
                logger.info("Received focus_search from Chrome Extension")
                chrome_manager.fire_focus_callback()

            elif msg_type == "connected":
                logger.info("Chrome Extension handshake received")

            elif msg_type == "pong":
                pass  # keepalive response

            else:
                logger.warning("Unknown message type: %s", msg_type)

    except WebSocketDisconnect:
        chrome_manager.disconnect()
        logger.info("Chrome Extension disconnected")
    except Exception as e:
        chrome_manager.disconnect()
        logger.error("WebSocket error: %s", e)


# --- Pydantic request models ---
class OpenTabGroupRequest(BaseModel):
    tag: str
    urls: list[str]
    color: str | None = None
    focusUrl: str | None = None


class TabIdRequest(BaseModel):
    tabId: int


class TagRequest(BaseModel):
    tag: str


class OpenSingleTabRequest(BaseModel):
    url: str
    tag: str | None = None


# --- REST endpoints: frontend → backend → extension ---
@rest_router.get("/chrome/tabs")
def get_chrome_tabs():
    return {
        "success": True,
        "data": {
            "connected": chrome_manager.connected,
            "tabs": chrome_manager.tabs,
        },
        "message": "OK",
    }


@rest_router.post("/chrome/open-tab-group")
async def open_tab_group(req: OpenTabGroupRequest):
    if not chrome_manager.connected:
        return {"success": False, "data": None, "message": "Chrome Extension not connected"}
    await chrome_manager.send_command("open_tab_group", {
        "tag": req.tag,
        "urls": req.urls,
        "color": req.color,
        "focusUrl": req.focusUrl,
    })
    return {"success": True, "data": None, "message": "Command sent"}


@rest_router.post("/chrome/open-single-tab")
async def open_single_tab(req: OpenSingleTabRequest):
    if not chrome_manager.connected:
        return {"success": False, "data": None, "message": "Chrome Extension not connected"}
    await chrome_manager.send_command("open_single_tab", {
        "url": req.url,
        "tag": req.tag,
    })
    return {"success": True, "data": None, "message": "Command sent"}


@rest_router.post("/chrome/switch-tab")
async def switch_tab(req: TabIdRequest):
    if not chrome_manager.connected:
        return {"success": False, "data": None, "message": "Chrome Extension not connected"}
    await chrome_manager.send_command("switch_tab", {"tabId": req.tabId})
    return {"success": True, "data": None, "message": "Command sent"}


@rest_router.post("/chrome/close-tab")
async def close_tab(req: TabIdRequest):
    if not chrome_manager.connected:
        return {"success": False, "data": None, "message": "Chrome Extension not connected"}
    await chrome_manager.send_command("close_tab", {"tabId": req.tabId})
    return {"success": True, "data": None, "message": "Command sent"}


@rest_router.post("/chrome/close-group")
async def close_group(req: TagRequest):
    if not chrome_manager.connected:
        return {"success": False, "data": None, "message": "Chrome Extension not connected"}
    await chrome_manager.send_command("close_group", {"tag": req.tag})
    return {"success": True, "data": None, "message": "Command sent"}

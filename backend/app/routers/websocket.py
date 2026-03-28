"""WebSocket endpoint for Chrome Extension communication."""

import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter()


class ChromeConnectionManager:
    """Manages the single WebSocket connection to Chrome Extension."""

    def __init__(self):
        self._ws: WebSocket | None = None
        self._tabs: list[dict] = []
        self._on_focus_search = None  # callback

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
        self._ws = websocket

    def disconnect(self):
        self._ws = None

    async def send_command(self, cmd_type: str, data: dict):
        """Send a command to the Chrome Extension."""
        if self._ws is None:
            logger.warning("No Chrome Extension connected, cannot send: %s", cmd_type)
            return
        await self._ws.send_json({"type": cmd_type, "data": data})

    def handle_tabs_updated(self, data: dict):
        self._tabs = data.get("tabs", [])

    def set_focus_callback(self, callback):
        self._on_focus_search = callback


chrome_manager = ChromeConnectionManager()


@router.websocket("/ws/chrome")
async def chrome_websocket(websocket: WebSocket):
    await websocket.accept()
    await chrome_manager.connect(websocket)
    logger.info("Chrome Extension connected")

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "tabs_updated":
                chrome_manager.handle_tabs_updated(msg.get("data", {}))

            elif msg_type == "focus_search":
                if chrome_manager._on_focus_search:
                    chrome_manager._on_focus_search()

            elif msg_type == "connected":
                logger.info("Chrome Extension handshake received")

    except WebSocketDisconnect:
        chrome_manager.disconnect()
        logger.info("Chrome Extension disconnected")
    except Exception as e:
        chrome_manager.disconnect()
        logger.error("WebSocket error: %s", e)

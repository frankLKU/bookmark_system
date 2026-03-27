"""TIBDP Desktop App — pywebview entry point.

Starts FastAPI in a background thread, then opens a pywebview main window
pointing at the local dashboard. BookmarkBridge exposes JS API for child windows.
"""

import json
import os
import socket
import sys
import threading
import time

import httpx
import uvicorn
import webview

# ---------------------------------------------------------------------------
# BookmarkBridge — JS API exposed as window.pywebview.api
# ---------------------------------------------------------------------------

class BookmarkBridge:
    def __init__(self):
        self._windows = {}  # tab_id -> webview.Window
        self._main_window = None

    def set_main_window(self, window):
        self._main_window = window

    def open_bookmark(self, tab_id, url, title):
        if tab_id in self._windows:
            self._focus_window(tab_id)
            return
        window = webview.create_window(title, url, width=1200, height=800)
        window.events.closed += lambda: self._on_child_closed(tab_id)
        self._windows[tab_id] = window

    def close_bookmark(self, tab_id):
        if tab_id in self._windows:
            window = self._windows.pop(tab_id)
            window.destroy()

    def focus_bookmark(self, tab_id):
        self._focus_window(tab_id)

    def close_all(self):
        for w in list(self._windows.values()):
            w.destroy()
        self._windows.clear()

    def _focus_window(self, tab_id):
        if tab_id in self._windows:
            w = self._windows[tab_id]
            w.show()
            w.minimize()
            w.restore()

    def _on_child_closed(self, tab_id):
        self._windows.pop(tab_id, None)
        try:
            if self._main_window:
                self._main_window.evaluate_js(
                    f"if(typeof Store!=='undefined')Store.closeTab({json.dumps(tab_id)})"
                )
        except Exception:
            pass  # Main window already destroyed


# ---------------------------------------------------------------------------
# Server thread
# ---------------------------------------------------------------------------

HOST = "127.0.0.1"
PORT = 8765


def _check_port_available():
    """Fail fast if another instance is already running."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        if s.connect_ex((HOST, PORT)) == 0:
            webview.create_window(
                "Error",
                html="<h2>Another instance is already running on port 8765</h2>",
                width=400, height=200,
            )
            webview.start()
            sys.exit(1)


def _start_server():
    """Run FastAPI/uvicorn in a daemon thread."""
    # Ensure backend package is importable
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    from app.main import app  # noqa: E402

    config = uvicorn.Config(app, host=HOST, port=PORT, log_level="warning")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    return server


def _wait_for_server(max_retries=20, interval=0.5):
    """Poll until the server is ready."""
    url = f"http://{HOST}:{PORT}/api/v1/bookmarks"
    for _ in range(max_retries):
        try:
            resp = httpx.get(url, timeout=2)
            if resp.status_code < 500:
                return True
        except httpx.ConnectError:
            pass
        time.sleep(interval)
    return False


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    _check_port_available()
    server = _start_server()

    if not _wait_for_server():
        webview.create_window(
            "Error",
            html="<h2>Server failed to start within 10 seconds</h2>",
            width=400, height=200,
        )
        webview.start()
        sys.exit(1)

    bridge = BookmarkBridge()
    main_window = webview.create_window(
        "TIBDP — Bookmark Dashboard",
        f"http://{HOST}:{PORT}",
        width=1400,
        height=900,
        js_api=bridge,
    )
    bridge.set_main_window(main_window)

    def on_closed():
        bridge.close_all()
        server.should_exit = True

    main_window.events.closed += on_closed
    webview.start()


if __name__ == "__main__":
    main()

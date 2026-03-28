"""TIBDP Desktop App — pywebview entry point.

Starts FastAPI in a background thread, then opens a pywebview main window
pointing at the local dashboard. Bookmarks open in the system browser.
Chrome Extension communicates via WebSocket for tab group control.
"""

import os
import platform
import socket
import sys
import threading
import time

import httpx
import uvicorn
import webview

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
# Focus handling (thread-safe)
# ---------------------------------------------------------------------------

def _bring_to_front(window):
    """Bring pywebview window to front and focus search box.

    Must be called from a separate thread (not the main GUI thread or the
    asyncio event loop thread). pywebview's evaluate_js dispatches to the
    main thread internally.
    """
    try:
        window.show()
        if platform.system() == "Darwin":
            try:
                from AppKit import NSApp  # pyobjc
                NSApp.activateIgnoringOtherApps_(True)
            except ImportError:
                pass  # pyobjc not installed, window.show() is best effort
        window.evaluate_js("document.querySelector('#search-input')?.focus()")
    except Exception:
        pass


def _setup_focus_callback(window):
    """Register the focus callback with the WebSocket manager.

    The callback is invoked from the asyncio event loop thread (WebSocket
    handler), so we dispatch _bring_to_front in a separate thread to avoid
    blocking the event loop and to let pywebview dispatch GUI calls safely.
    """
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    from app.routers.websocket import chrome_manager

    def on_focus_search():
        threading.Thread(
            target=_bring_to_front,
            args=(window,),
            daemon=True,
        ).start()

    chrome_manager.set_focus_callback(on_focus_search)


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

    # Position menubar on the left 20% of screen
    try:
        screen = webview.screens[0]
        screen_width = screen.width
        screen_height = screen.height
    except Exception:
        screen_width = 3440
        screen_height = 1440

    menubar_width = int(screen_width * 0.1)

    main_window = webview.create_window(
        "TIBDP — Bookmark Dashboard",
        f"http://{HOST}:{PORT}",
        x=0,
        y=0,
        width=menubar_width,
        height=screen_height,
    )

    def on_closed():
        server.should_exit = True

    def on_shown():
        _setup_focus_callback(main_window)

    main_window.events.closed += on_closed
    main_window.events.shown += on_shown
    webview.start()


if __name__ == "__main__":
    main()

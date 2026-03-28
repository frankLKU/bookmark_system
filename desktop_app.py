"""TIBDP Desktop App — pywebview entry point.

Starts FastAPI in a background thread, then opens a pywebview main window
pointing at the local dashboard. Bookmarks open in the system browser.
"""

import os
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

    main_window = webview.create_window(
        "TIBDP — Bookmark Dashboard",
        f"http://{HOST}:{PORT}",
        width=1400,
        height=900,
    )

    def on_closed():
        server.should_exit = True

    main_window.events.closed += on_closed
    webview.start()


if __name__ == "__main__":
    main()

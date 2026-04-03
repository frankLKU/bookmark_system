"""TIBDP Desktop App — pywebview entry point.

Starts FastAPI in a background thread, then opens a pywebview main window
pointing at the local dashboard. Bookmarks open via Playwright-controlled
Chromium. Global hotkey Ctrl+Shift+F focuses the search box.
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
# ChromeBrowserManager startup
# ---------------------------------------------------------------------------

def _start_browser_manager():
    """Start the Playwright-based browser manager."""
    backend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend")
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    from app.routers.chrome import browser_manager
    browser_manager.start()
    return browser_manager


# ---------------------------------------------------------------------------
# Global hotkey
# ---------------------------------------------------------------------------

def _setup_global_hotkey(window):
    """Register Ctrl+Shift+F as global hotkey to focus search box."""
    try:
        from pynput.keyboard import GlobalHotKeys

        def on_activate():
            threading.Thread(
                target=_bring_to_front,
                args=(window,),
                daemon=True,
            ).start()

        hotkeys = GlobalHotKeys({"<ctrl>+<shift>+f": on_activate})
        hotkeys.daemon = True
        hotkeys.start()
        return hotkeys
    except ImportError:
        pass  # pynput not available
    return None


# ---------------------------------------------------------------------------
# Focus handling (thread-safe)
# ---------------------------------------------------------------------------

def _bring_to_front(window):
    """Bring pywebview window to front and focus search box."""
    try:
        if platform.system() == "Darwin":
            try:
                from AppKit import NSApp, NSApplication
                NSApp.activateIgnoringOtherApps_(True)
            except ImportError:
                pass
            window.show()
        elif platform.system() == "Windows":
            try:
                import ctypes
                user32 = ctypes.windll.user32
                hwnd = user32.FindWindowW(None, "TIBDP — Bookmark Dashboard")
                if hwnd:
                    # Windows blocks SetForegroundWindow unless the calling
                    # thread is the foreground thread.  Simulate an Alt press
                    # to satisfy the OS check, then restore & focus.
                    VK_MENU = 0x12          # Alt key
                    KEYEVENTF_EXTENDEDKEY = 0x0001
                    KEYEVENTF_KEYUP = 0x0002
                    SW_RESTORE = 9
                    user32.keybd_event(VK_MENU, 0, KEYEVENTF_EXTENDEDKEY, 0)
                    user32.keybd_event(VK_MENU, 0, KEYEVENTF_EXTENDEDKEY | KEYEVENTF_KEYUP, 0)
                    user32.ShowWindow(hwnd, SW_RESTORE)
                    user32.SetForegroundWindow(hwnd)
            except Exception:
                pass
            window.show()
        else:
            window.show()
        time.sleep(0.15)  # brief wait for window to reach foreground
        window.evaluate_js("document.querySelector('#search-input')?.focus()")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Screen detection
# ---------------------------------------------------------------------------

def _get_screen_size():
    """Get primary screen dimensions."""
    try:
        screen = webview.screens[0]
        return screen.width, screen.height
    except Exception:
        pass
    try:
        if platform.system() == "Windows":
            import ctypes
            user32 = ctypes.windll.user32
            return user32.GetSystemMetrics(0), user32.GetSystemMetrics(1)
    except Exception:
        pass
    return 3440, 1440


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

    # Start Playwright browser (after server ready, before pywebview)
    browser_mgr = _start_browser_manager()

    # Screen layout
    screen_width, screen_height = _get_screen_size()
    menubar_width = int(screen_width * 0.1)

    main_window = webview.create_window(
        "TIBDP — Bookmark Dashboard",
        f"http://{HOST}:{PORT}",
        x=0,
        y=0,
        width=menubar_width,
        height=screen_height,
    )

    hotkey_listener = None

    def on_closed():
        browser_mgr.stop()
        server.should_exit = True

    def on_shown():
        nonlocal hotkey_listener
        hotkey_listener = _setup_global_hotkey(main_window)

    main_window.events.closed += on_closed
    main_window.events.shown += on_shown
    webview.start()


if __name__ == "__main__":
    main()

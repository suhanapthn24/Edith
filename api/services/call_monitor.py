"""
Background thread that watches for Phone Link incoming call toast notifications.
Pushes call events to connected SSE clients.
Uses win32gui.EnumWindows which captures ALL windows including toast popups.
"""

import threading
import time
from typing import Callable

_listeners: list[Callable[[dict], None]] = []
_lock = threading.Lock()
_current_call: dict = {"status": "idle", "caller": ""}

# Keywords that appear in Phone Link incoming call toast titles
_CALL_KEYWORDS = ("incoming call", "is calling", "mobile call")
# Phone Link window base name
_PHONE_LINK = "phone link"


def get_call_state() -> dict:
    return dict(_current_call)


def add_listener(cb: Callable[[dict], None]) -> None:
    with _lock:
        _listeners.append(cb)


def remove_listener(cb: Callable[[dict], None]) -> None:
    with _lock:
        if cb in _listeners:
            _listeners.remove(cb)


def _notify(event: dict) -> None:
    with _lock:
        listeners = list(_listeners)
    for cb in listeners:
        try:
            cb(event)
        except Exception:
            pass


def _get_all_windows() -> list[tuple[int, str]]:
    """Enumerate every top-level window including toast notification popups."""
    try:
        import win32gui  # type: ignore
        windows: list[tuple[int, str]] = []

        def _cb(hwnd, _):
            try:
                title = win32gui.GetWindowText(hwnd)
                if title:
                    windows.append((hwnd, title))
            except Exception:
                pass
            return True

        win32gui.EnumWindows(_cb, None)
        return windows
    except ImportError:
        # Fallback to pygetwindow if pywin32 not available
        try:
            import pygetwindow as gw  # type: ignore
            result = []
            for w in gw.getAllWindows():
                try:
                    result.append((w._hWnd, w.title))
                except Exception:
                    pass
            return result
        except Exception:
            return []


def _is_call_window(title: str) -> bool:
    t = title.lower()
    return any(k in t for k in _CALL_KEYWORDS)


def _extract_caller(title: str) -> str:
    """Pull caller name out of a toast title like 'hamster🐹 Incoming Call via Phone Link'."""
    t_lower = title.lower()
    # "hamster Incoming Call via Phone Link" → "hamster"
    for kw in _CALL_KEYWORDS:
        idx = t_lower.find(kw)
        if idx > 0:
            part = title[:idx].strip()
            if part:
                return part
    # Fallback: split on separators
    for sep in [" — ", " - ", ": "]:
        if sep in title:
            part = title.split(sep, 1)[-1].strip()
            if part and part.lower() not in ("phone link", "incoming call"):
                return part
    return "Unknown"


def _monitor_loop() -> None:
    global _current_call
    prev_titles: dict[int, str] = {}
    idle_ticks = 0

    while True:
        try:
            windows = _get_all_windows()
            curr_titles = dict(windows)

            if _current_call["status"] not in ("incoming",):
                # Look for any window whose title signals an incoming call
                for hwnd, title in curr_titles.items():
                    if _is_call_window(title):
                        caller = _extract_caller(title)
                        _current_call = {"status": "incoming", "caller": caller}
                        _notify({"type": "incoming_call", "caller": caller})
                        idle_ticks = 0
                        break

                # Also watch for Phone Link window title changes
                if _current_call["status"] != "incoming":
                    for hwnd, title in curr_titles.items():
                        old = prev_titles.get(hwnd, "")
                        is_phone_link = _PHONE_LINK in title.lower() or _PHONE_LINK in old.lower()
                        if is_phone_link and title != old and title.lower() not in (_PHONE_LINK, ""):
                            caller = _extract_caller(title)
                            if caller != "Unknown" or _is_call_window(title):
                                _current_call = {"status": "incoming", "caller": caller}
                                _notify({"type": "incoming_call", "caller": caller})
                                idle_ticks = 0
                                break

            else:
                # Detect call ended: no more call-like windows
                still_ringing = any(_is_call_window(t) for t in curr_titles.values())
                if not still_ringing:
                    idle_ticks += 1
                    if idle_ticks >= 2:
                        idle_ticks = 0
                        _current_call = {"status": "idle", "caller": ""}
                        _notify({"type": "call_ended"})
                else:
                    idle_ticks = 0

            prev_titles = curr_titles
        except Exception:
            pass

        time.sleep(1.0)


def start() -> None:
    t = threading.Thread(target=_monitor_loop, daemon=True)
    t.start()

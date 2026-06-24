import time

from langchain_core.tools import tool


_CALL_KEYWORDS = ("incoming call", "is calling", "mobile call")
_PHONE_LINK = "phone link"


def _get_all_windows() -> list[tuple[int, str]]:
    """Return (hwnd, title) for every top-level window."""
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
        try:
            import pygetwindow as gw  # type: ignore
            return [(w._hWnd, w.title) for w in gw.getAllWindows()]
        except Exception:
            return []


def _find_call_window() -> tuple[int, str] | None:
    """Return (hwnd, title) of the incoming call toast, or None."""
    for hwnd, title in _get_all_windows():
        t = title.lower()
        if any(k in t for k in _CALL_KEYWORDS):
            return hwnd, title
        if _PHONE_LINK in t and t != _PHONE_LINK:
            return hwnd, title
    return None


def _click_in_hwnd(hwnd: int, rel_x: float, rel_y: float) -> None:
    import win32gui  # type: ignore
    import pyautogui  # type: ignore
    left, top, right, bottom = win32gui.GetWindowRect(hwnd)
    w = right - left
    h = bottom - top
    x = left + int(w * rel_x)
    y = top + int(h * rel_y)
    # Bring window to front then click
    try:
        import win32con  # type: ignore
        win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
        win32gui.SetForegroundWindow(hwnd)
    except Exception:
        pass
    time.sleep(0.3)
    pyautogui.click(x, y)


@tool
def answer_call() -> str:
    """Answer an incoming phone call shown in the Phone Link toast notification.
    Use when the user says 'answer', 'pick up', 'answer it', or 'answer the call'."""
    result = _find_call_window()
    if not result:
        return "No incoming call notification found."
    hwnd, title = result
    try:
        # Toast layout: [Use mobile device] [Message] [Decline]
        # "Use mobile device" button is at ~left-third of the bottom row
        _click_in_hwnd(hwnd, rel_x=0.18, rel_y=0.82)
        from services.call_monitor import _current_call  # type: ignore
        _current_call.update({"status": "active"})
        return "Call answered."
    except Exception as e:
        return f"Could not answer call: {e}"


@tool
def decline_call() -> str:
    """Decline an incoming phone call shown in the Phone Link toast notification.
    Use when the user says 'decline', 'reject', 'ignore', or 'hang up'."""
    result = _find_call_window()
    if not result:
        return "No incoming call notification found."
    hwnd, title = result
    try:
        # "Decline" button is at ~right-third of the bottom row
        _click_in_hwnd(hwnd, rel_x=0.82, rel_y=0.82)
        from services.call_monitor import _current_call  # type: ignore
        _current_call.update({"status": "idle", "caller": ""})
        return "Call declined."
    except Exception as e:
        return f"Could not decline call: {e}"

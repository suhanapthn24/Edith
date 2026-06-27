"""
Productivity tools: clipboard history, Pomodoro timer, window layout presets,
text snippets, daily briefing.
"""

import json
import subprocess
import threading
import time
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any

from langchain_core.tools import tool

# ── Clipboard History ─────────────────────────────────────────────────────────

_clipboard_history: deque[str] = deque(maxlen=20)
_last_clip = ""


def _clipboard_monitor():
    global _last_clip
    while True:
        try:
            import pyperclip  # type: ignore
            cur = pyperclip.paste()
            if cur and cur != _last_clip:
                _clipboard_history.appendleft(cur)
                _last_clip = cur
        except Exception:
            pass
        time.sleep(1.5)


# Start background monitor thread on import
_monitor_thread = threading.Thread(target=_clipboard_monitor, daemon=True)
_monitor_thread.start()


@tool
def get_clipboard_history(count: int = 10) -> str:
    """Get the last N clipboard entries (auto-captured in background).
    count: how many to show (default 10, max 20)."""
    items = list(_clipboard_history)[:min(count, 20)]
    if not items:
        return "Clipboard history is empty."
    lines = [f"{i+1}. {item[:120]}{'...' if len(item)>120 else ''}"
             for i, item in enumerate(items)]
    return "Clipboard history (newest first):\n" + "\n".join(lines)


@tool
def paste_from_history(index: int) -> str:
    """Copy a past clipboard item back to the clipboard so it can be pasted.
    index: 1-based position from get_clipboard_history (1 = most recent)."""
    items = list(_clipboard_history)
    if not items:
        return "Clipboard history is empty."
    idx = index - 1
    if idx < 0 or idx >= len(items):
        return f"Index out of range. History has {len(items)} items."
    try:
        import pyperclip
        pyperclip.copy(items[idx])
    except ImportError:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             f"Set-Clipboard -Value '{items[idx].replace(chr(39), chr(39)*2)}'"],
            capture_output=True, timeout=8,
        )
    return f"Copied item #{index} back to clipboard: {items[idx][:80]}..."


# ── Text Snippets ─────────────────────────────────────────────────────────────

_SNIPPETS_FILE = Path.home() / ".edith_snippets.json"


def _load_snippets() -> dict[str, str]:
    try:
        return json.loads(_SNIPPETS_FILE.read_text())
    except Exception:
        return {}


def _save_snippets(snips: dict[str, str]) -> None:
    _SNIPPETS_FILE.write_text(json.dumps(snips, indent=2))


@tool
def add_snippet(key: str, text: str) -> str:
    """Save a text snippet that can be expanded later by key.
    Examples: add_snippet('sig', 'Best regards,\\nSuhana') → later 'type sig' expands it.
    key: short trigger word. text: the full text to expand to."""
    snips = _load_snippets()
    snips[key.lower()] = text
    _save_snippets(snips)
    return f"Snippet '{key}' saved ({len(text)} chars)."


@tool
def expand_snippet(key: str) -> str:
    """Copy a saved snippet to clipboard ready to paste, or type it directly.
    key: the trigger word you saved with add_snippet."""
    snips = _load_snippets()
    text = snips.get(key.lower())
    if not text:
        available = ", ".join(snips.keys()) if snips else "none saved"
        return f"No snippet '{key}'. Available: {available}"
    try:
        import pyperclip
        pyperclip.copy(text)
    except ImportError:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             f"Set-Clipboard -Value '{text.replace(chr(39), chr(39)*2)}'"],
            capture_output=True, timeout=8,
        )
    return f"Snippet '{key}' copied to clipboard. Press Ctrl+V to paste."


@tool
def list_snippets() -> str:
    """List all saved text snippets."""
    snips = _load_snippets()
    if not snips:
        return "No snippets saved. Use add_snippet(key, text) to create one."
    lines = [f"• {k}: {v[:60]}{'...' if len(v)>60 else ''}" for k, v in snips.items()]
    return "Saved snippets:\n" + "\n".join(lines)


# ── Pomodoro Timer ───────────────────────────────────────────────────────────

_pomo_thread: threading.Thread | None = None
_pomo_active = False


def _pomodoro_run(work_min: int, break_min: int, cycles: int):
    global _pomo_active
    try:
        import subprocess as sp
        def toast(title, msg):
            ps = f"""
Add-Type -AssemblyName System.Windows.Forms
$n=New-Object System.Windows.Forms.NotifyIcon
$n.Icon=[System.Drawing.SystemIcons]::Information
$n.BalloonTipTitle='{title}'; $n.BalloonTipText='{msg}'; $n.Visible=$True
$n.ShowBalloonTip(8000); Start-Sleep 9; $n.Dispose()
"""
            sp.Popen(["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps])

        for cycle in range(1, cycles + 1):
            if not _pomo_active:
                break
            toast(f"🍅 Pomodoro #{cycle}", f"Focus for {work_min} minutes. Go!")
            time.sleep(work_min * 60)
            if not _pomo_active:
                break
            if cycle < cycles:
                toast("⏸ Break time!", f"Take a {break_min}-minute break.")
                time.sleep(break_min * 60)

        if _pomo_active:
            toast("✅ Pomodoro done!", f"Completed {cycles} cycles. Great work!")
    finally:
        _pomo_active = False


@tool
def start_pomodoro(work_minutes: int = 25, break_minutes: int = 5, cycles: int = 4) -> str:
    """Start a Pomodoro focus timer with desktop notifications.
    work_minutes: focus duration per cycle (default 25).
    break_minutes: break duration between cycles (default 5).
    cycles: number of work cycles before stopping (default 4)."""
    global _pomo_thread, _pomo_active
    if _pomo_active:
        return "Pomodoro already running. Call stop_pomodoro() first."
    _pomo_active = True
    _pomo_thread = threading.Thread(
        target=_pomodoro_run,
        args=(work_minutes, break_minutes, cycles),
        daemon=True,
    )
    _pomo_thread.start()
    total = work_minutes * cycles + break_minutes * (cycles - 1)
    return (
        f"Pomodoro started: {cycles} × {work_minutes}min work + {break_minutes}min breaks. "
        f"Total: {total} minutes. You'll get desktop notifications."
    )


@tool
def stop_pomodoro() -> str:
    """Stop the currently running Pomodoro timer."""
    global _pomo_active
    if not _pomo_active:
        return "No Pomodoro timer is running."
    _pomo_active = False
    return "Pomodoro timer stopped."


# ── Window Layout Presets ─────────────────────────────────────────────────────

_LAYOUTS_FILE = Path.home() / ".edith_layouts.json"


def _load_layouts() -> dict[str, Any]:
    try:
        return json.loads(_LAYOUTS_FILE.read_text())
    except Exception:
        return {}


def _save_layouts(layouts: dict) -> None:
    _LAYOUTS_FILE.write_text(json.dumps(layouts, indent=2))


@tool
def save_window_layout(name: str) -> str:
    """Save the current positions and sizes of all open windows as a named layout.
    name: a short label like 'coding', 'study', 'gaming'.
    Restore later with restore_window_layout(name)."""
    try:
        import pygetwindow as gw  # type: ignore
        windows = []
        for w in gw.getAllWindows():
            if not w.title.strip() or w.isMinimized:
                continue
            windows.append({
                "title": w.title,
                "left": w.left,
                "top": w.top,
                "width": w.width,
                "height": w.height,
            })
        if not windows:
            return "No visible windows to save."
        layouts = _load_layouts()
        layouts[name.lower()] = {"windows": windows, "saved": datetime.now().isoformat()}
        _save_layouts(layouts)
        return f"Layout '{name}' saved with {len(windows)} windows."
    except ImportError:
        return "Requires: pip install pygetwindow"
    except Exception as e:
        return f"Failed: {e}"


@tool
def restore_window_layout(name: str) -> str:
    """Restore a previously saved window layout — moves and resizes windows to their saved positions.
    name: layout name from save_window_layout."""
    try:
        import pygetwindow as gw  # type: ignore
        layouts = _load_layouts()
        layout = layouts.get(name.lower())
        if not layout:
            available = ", ".join(layouts.keys()) if layouts else "none saved"
            return f"Layout '{name}' not found. Available: {available}"

        restored = 0
        for saved in layout["windows"]:
            matches = [w for w in gw.getAllWindows()
                       if saved["title"].lower() in w.title.lower() and w.title.strip()]
            if matches:
                w = matches[0]
                if w.isMinimized:
                    w.restore()
                w.moveTo(saved["left"], saved["top"])
                w.resizeTo(saved["width"], saved["height"])
                restored += 1

        return f"Restored {restored}/{len(layout['windows'])} windows for layout '{name}'."
    except ImportError:
        return "Requires: pip install pygetwindow"
    except Exception as e:
        return f"Failed: {e}"


@tool
def list_window_layouts() -> str:
    """List all saved window layout presets."""
    layouts = _load_layouts()
    if not layouts:
        return "No layouts saved. Use save_window_layout(name) to create one."
    lines = []
    for name, data in layouts.items():
        count = len(data.get("windows", []))
        saved = data.get("saved", "")[:10]
        lines.append(f"• {name} — {count} windows (saved {saved})")
    return "Window layouts:\n" + "\n".join(lines)


# ── Daily Briefing ────────────────────────────────────────────────────────────

@tool
def daily_briefing() -> str:
    """Generate a morning briefing: date/time, battery, top calendar events, and system status.
    For weather/gmail/spotify details the agent will call those specific tools — this gives the
    structural summary and system state."""
    import psutil
    from datetime import datetime

    now = datetime.now()
    lines = [
        f"◈ DAILY BRIEFING — {now.strftime('%A, %B %d %Y  %H:%M')}",
        "",
    ]

    # Battery
    try:
        b = psutil.sensors_battery()
        if b:
            pct = round(b.percent)
            status = "charging" if b.power_plugged else "on battery"
            lines.append(f"🔋 Battery: {pct}% ({status})")
    except Exception:
        pass

    # System health
    try:
        cpu = psutil.cpu_percent(interval=0.3)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("C:\\")
        lines.append(f"💻 System: CPU {cpu}%  RAM {mem.percent}%  Disk {disk.percent}%")
    except Exception:
        pass

    lines += [
        "",
        "📅 To get your schedule: call list_calendar_events",
        "📧 To check email: call list_emails with query='is:unread'",
        "🌤 To get weather: call get_weather",
        "",
        "◈ EDITH is ready.",
    ]
    return "\n".join(lines)

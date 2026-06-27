"""
Productivity tools: clipboard history, Pomodoro timer, window layout presets,
text snippets, daily briefing.
"""

import asyncio
import json
import re
import subprocess
import threading
import time
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Any

from langchain_core.tools import tool

# ── Event loop reference (set by main.py on startup) ─────────────────────────
_event_loop: asyncio.AbstractEventLoop | None = None


def set_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _event_loop
    _event_loop = loop


def _push(coro) -> None:
    """Schedule a coroutine on the main event loop from any thread."""
    if _event_loop and not _event_loop.is_closed():
        asyncio.run_coroutine_threadsafe(coro, _event_loop)


def _get_idle_seconds() -> float:
    """Seconds since last keyboard/mouse input (Windows only). Returns 0 on error."""
    try:
        import ctypes

        class _LASTINPUTINFO(ctypes.Structure):
            _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

        lii = _LASTINPUTINFO()
        lii.cbSize = ctypes.sizeof(_LASTINPUTINFO)
        ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii))
        millis = ctypes.windll.kernel32.GetTickCount() - lii.dwTime
        return max(0.0, millis / 1000.0)
    except Exception:
        return 0.0


def _spotify_play_context(context: str) -> None:
    """Search and silently play a Spotify playlist suited to context ('focus' or 'break')."""
    queries = {
        "focus": "lofi hip hop focus instrumental study",
        "break": "upbeat energizing short break",
    }
    try:
        from agent.tools.spotify import _api, _get_device_id  # type: ignore

        query = queries.get(context, "lofi")
        data = _api("GET", "/search", params={"q": query, "type": "playlist", "limit": 1})
        items = data.get("playlists", {}).get("items", [])
        if not items:
            return
        uri = items[0].get("uri")
        if not uri:
            return
        device_id = _get_device_id()
        params = {"device_id": device_id} if device_id else {}
        _api("PUT", "/me/player/play", params=params, json={"context_uri": uri})
    except Exception:
        pass

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


async def _pomo_broadcast(active: bool, cycle: int, total: int, state: str, remaining_sec: int) -> None:
    from routers.hologram import manager  # type: ignore
    await manager.broadcast({
        "type": "pomodoro",
        "active": active,
        "cycle": cycle,
        "total": total,
        "state": state,
        "remaining_sec": remaining_sec,
    })


async def _pomo_alert(title: str, msg: str) -> None:
    from routers.hologram import trigger_alert  # type: ignore
    await trigger_alert(title, msg)


def _toast(title: str, msg: str) -> None:
    ps = f"""
Add-Type -AssemblyName System.Windows.Forms
$n=New-Object System.Windows.Forms.NotifyIcon
$n.Icon=[System.Drawing.SystemIcons]::Information
$n.BalloonTipTitle='{title}'; $n.BalloonTipText='{msg}'; $n.Visible=$True
$n.ShowBalloonTip(8000); Start-Sleep 9; $n.Dispose()
"""
    subprocess.Popen(["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps])


def _pomodoro_run(work_min: int, break_min: int, cycles: int):
    global _pomo_active, _focus_mode_active
    cycles_done = 0
    try:
        for cycle in range(1, cycles + 1):
            if not _pomo_active:
                break

            # ── Work phase ──
            _toast(f"Pomodoro #{cycle}", f"Focus for {work_min} minutes. Go!")
            _push(_pomo_alert(f"POMODORO #{cycle}", f"Focus {work_min} min — go!"))
            _push(_pomo_broadcast(True, cycle, cycles, "FOCUS", work_min * 60))
            if _focus_mode_active:
                threading.Thread(target=_spotify_play_context, args=("focus",), daemon=True).start()

            idle_alerted = False
            remaining = work_min * 60
            while remaining > 0 and _pomo_active:
                sleep_t = min(30, remaining)
                time.sleep(sleep_t)
                remaining -= sleep_t
                if _pomo_active:
                    _push(_pomo_broadcast(True, cycle, cycles, "FOCUS", remaining))
                    idle_sec = _get_idle_seconds()
                    if idle_sec >= 180 and not idle_alerted:
                        idle_alerted = True
                        _push(_pomo_alert(
                            "STILL THERE?",
                            f"No activity for {int(idle_sec) // 60}+ min — still working?"
                        ))
                    elif idle_sec < 60:
                        idle_alerted = False

            if not _pomo_active:
                break
            cycles_done += 1

            # ── Break phase ──
            if cycle < cycles:
                _toast("Break time!", f"Take a {break_min}-minute break.")
                _push(_pomo_alert("BREAK TIME", f"{break_min} min break — relax!"))
                _push(_pomo_broadcast(True, cycle, cycles, "BREAK", break_min * 60))
                if _focus_mode_active:
                    threading.Thread(target=_spotify_play_context, args=("break",), daemon=True).start()

                remaining = break_min * 60
                while remaining > 0 and _pomo_active:
                    sleep_t = min(30, remaining)
                    time.sleep(sleep_t)
                    remaining -= sleep_t
                    if _pomo_active:
                        _push(_pomo_broadcast(True, cycle, cycles, "BREAK", remaining))

        if _pomo_active and cycles_done == cycles:
            _toast("Pomodoro done!", f"Completed {cycles} cycles. Great work!")
            _push(_pomo_alert("POMODORO DONE", f"Completed {cycles} cycles — great work!"))
    finally:
        _pomo_active = False
        _focus_mode_active = False
        _push(_pomo_broadcast(False, 0, cycles, "DONE", 0))
        _record_pomo_session(work_min, cycles_done)


_focus_mode_active: bool = False

# ── Pomodoro stats ─────────────────────────────────────────────────────────────

_POMO_STATS_FILE = Path.home() / ".edith_pomo_stats.json"


def _load_pomo_stats() -> dict:
    try:
        return json.loads(_POMO_STATS_FILE.read_text())
    except Exception:
        return {"sessions": []}


def _save_pomo_stats(stats: dict) -> None:
    try:
        _POMO_STATS_FILE.write_text(json.dumps(stats, indent=2))
    except Exception:
        pass


def _record_pomo_session(work_min: int, cycles_done: int) -> None:
    if cycles_done == 0:
        return
    stats = _load_pomo_stats()
    stats["sessions"].append({
        "date": datetime.now().strftime("%Y-%m-%d"),
        "time": datetime.now().strftime("%H:%M"),
        "work_min": work_min,
        "cycles": cycles_done,
        "focus_min": work_min * cycles_done,
    })
    _save_pomo_stats(stats)


# ─────────────────────────────────────────────────────────────────────────────


@tool
def start_pomodoro(work_minutes: int = 25, break_minutes: int = 5, cycles: int = 4) -> str:
    """Start a Pomodoro focus timer with desktop notifications and hologram overlay.
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
        f"Total: {total} minutes."
    )


@tool
def stop_pomodoro() -> str:
    """Stop the currently running Pomodoro timer."""
    global _pomo_active
    if not _pomo_active:
        return "No Pomodoro timer is running."
    _pomo_active = False
    return "Pomodoro timer stopped."


@tool
def get_pomodoro_stats(days: int = 7) -> str:
    """Get Pomodoro focus statistics for the last N days.
    days: look-back window (default 7)."""
    from datetime import timedelta
    stats = _load_pomo_stats()
    sessions = stats.get("sessions", [])
    if not sessions:
        return "No Pomodoro sessions recorded yet. Start one with start_pomodoro()."
    cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
    recent = [s for s in sessions if s.get("date", "") >= cutoff]
    if not recent:
        return f"No Pomodoro sessions in the last {days} days."
    total_focus = sum(s.get("focus_min", 0) for s in recent)
    total_cycles = sum(s.get("cycles", 0) for s in recent)
    avg_per_day = total_focus / max(days, 1)
    by_date: dict[str, int] = {}
    for s in recent:
        d = s.get("date", "")
        by_date[d] = by_date.get(d, 0) + s.get("focus_min", 0)
    top_day = max(by_date, key=lambda d: by_date[d]) if by_date else ""
    return (
        f"Pomodoro stats — last {days} days:\n"
        f"• Sessions: {len(recent)}\n"
        f"• Total cycles: {total_cycles}\n"
        f"• Total focus: {total_focus} min ({total_focus//60}h {total_focus%60}m)\n"
        f"• Daily average: {avg_per_day:.0f} min\n"
        f"• Best day: {top_day} ({by_date.get(top_day, 0)} min)" if top_day else ""
    )


# ── Focus mode ─────────────────────────────────────────────────────────────────

@tool
def focus_mode(work_minutes: int = 25, break_minutes: int = 5, cycles: int = 4) -> str:
    """Activate focus mode: starts Pomodoro timer and suppresses email / non-critical alerts.
    Disables distraction interruptions for the full session duration.
    work_minutes, break_minutes, cycles: Pomodoro configuration."""
    global _focus_mode_active, _pomo_active, _pomo_thread
    if _pomo_active:
        return "Pomodoro already running. Stop it first or let it finish."
    _focus_mode_active = True
    _pomo_active = True
    _pomo_thread = threading.Thread(
        target=_pomodoro_run,
        args=(work_minutes, break_minutes, cycles),
        daemon=True,
    )
    _pomo_thread.start()
    total = work_minutes * cycles + break_minutes * (cycles - 1)
    return (
        f"Focus mode active. {cycles}×{work_minutes}min Pomodoro started. "
        f"Email and notification alerts suppressed for {total} minutes. "
        f"Say 'exit focus mode' to stop early."
    )


@tool
def exit_focus_mode() -> str:
    """Exit focus mode: stops the active Pomodoro and re-enables all alerts."""
    global _focus_mode_active, _pomo_active
    if not _focus_mode_active and not _pomo_active:
        return "Focus mode is not active."
    _focus_mode_active = False
    _pomo_active = False
    return "Focus mode ended. Pomodoro stopped. All alerts restored."


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


@tool
def generate_standup() -> str:
    """Draft a daily standup message using Pomodoro focus data for yesterday and today.
    Copies the draft to clipboard. The agent should also call list_tasks to fill in
    completed and planned task sections."""
    from datetime import timedelta

    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")

    stats = _load_pomo_stats()
    yest_focus = sum(s.get("focus_min", 0) for s in stats.get("sessions", []) if s.get("date") == yesterday)
    today_focus = sum(s.get("focus_min", 0) for s in stats.get("sessions", []) if s.get("date") == today)
    today_cycles = sum(s.get("cycles", 0) for s in stats.get("sessions", []) if s.get("date") == today)

    health = ""
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.2)
        mem = psutil.virtual_memory()
        health = f"  ·  CPU {cpu:.0f}%  RAM {mem.percent:.0f}%"
    except Exception:
        pass

    lines = [f"*Standup — {now.strftime('%A, %B %d')}*", ""]

    lines.append("*Yesterday:*")
    if yest_focus:
        lines.append(f"• Focused {yest_focus}min ({yest_focus // 60}h {yest_focus % 60}m)")
    lines.append("• Completed: [call list_tasks status=done to fill in]")

    lines += ["", "*Today:*"]
    if today_focus:
        lines.append(f"• Focused so far: {today_cycles} cycles / {today_focus}min{health}")
    lines.append("• Working on: [call list_tasks status=active to fill in]")
    lines += ["", "*Blockers:* None"]

    text = "\n".join(lines)
    try:
        import pyperclip  # type: ignore
        pyperclip.copy(text)
    except Exception:
        try:
            safe = text.replace("'", "''")
            subprocess.run(
                ["powershell", "-NoProfile", "-Command", f"Set-Clipboard -Value '{safe}'"],
                capture_output=True, timeout=8,
            )
        except Exception:
            pass

    return text + "\n\n(Draft copied to clipboard — say 'list my active tasks' to complete it)"


@tool
def daily_summary() -> str:
    """Generate an end-of-day summary: focus time from Pomodoro sessions today,
    plus prompts to retrieve tasks and email activity from other tools."""
    now = datetime.now()
    today = now.strftime("%Y-%m-%d")
    lines = [f"◈ DAILY SUMMARY — {now.strftime('%A, %B %d %Y')}"]

    # Pomodoro stats for today
    stats = _load_pomo_stats()
    today_sessions = [s for s in stats.get("sessions", []) if s.get("date") == today]
    if today_sessions:
        total_focus = sum(s.get("focus_min", 0) for s in today_sessions)
        total_cycles = sum(s.get("cycles", 0) for s in today_sessions)
        lines.append(f"🍅 Focus time: {total_focus} min across {total_cycles} Pomodoro cycles")
    else:
        lines.append("🍅 No Pomodoro sessions today")

    # System health snapshot
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.2)
        mem = psutil.virtual_memory()
        lines.append(f"💻 System load: CPU {cpu:.0f}%  RAM {mem.percent:.0f}%")
    except Exception:
        pass

    lines += [
        "",
        "📋 Tasks completed today: call list_tasks with status='done'",
        "📧 Emails sent today: check Gmail sent folder with list_emails",
        "",
        "◈ Great work today. Rest well.",
    ]
    return "\n".join(lines)

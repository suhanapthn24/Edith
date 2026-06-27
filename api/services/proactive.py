"""
Proactive scheduler — fires alerts and speaks proactively.
Checks (all on 60-second ticks unless noted):
  - Morning briefing (once per day, 7–10 am)
  - Calendar 5-minute warnings
  - Email arrival (every 5 ticks)
  - Past-due tasks (every 5 ticks)
  - Battery low / critical
  - CPU / RAM spike (3 consecutive high ticks)
  - Phone notifications via ADB (every 3 ticks)
  - End-of-day summary prompt (once per day, 6–8 pm)
"""

import asyncio
import re
from datetime import datetime, timedelta

# ── State ─────────────────────────────────────────────────────────────────────
_alerted_events: set[str] = set()
_last_email_count: int = -1
_alerted_overdue: set[int] = set()
_cpu_high_ticks: int = 0
_ram_high_ticks: int = 0
_battery_low_alerted: bool = False
_battery_critical_alerted: bool = False
_briefing_date: str = ""
_eod_date: str = ""
_seen_phone_notifs: set[str] = set()


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _alert(title: str, msg: str) -> None:
    from routers.hologram import trigger_alert  # type: ignore
    await trigger_alert(title, msg)


async def _speak(text: str) -> None:
    from routers.hologram import manager  # type: ignore
    await manager.broadcast({"type": "speak", "text": text})


def _focus_active() -> bool:
    try:
        from agent.tools.productivity import _focus_mode_active  # type: ignore
        return _focus_mode_active
    except Exception:
        return False


# ── Calendar ──────────────────────────────────────────────────────────────────

async def _calendar_check() -> None:
    try:
        from agent.tools.google_calendar import list_calendar_events  # type: ignore

        today = datetime.now().strftime("%Y-%m-%d")
        raw: str = await asyncio.to_thread(list_calendar_events.invoke, {"date": today})
        if not isinstance(raw, str):
            return

        now = datetime.now()
        for line in raw.splitlines():
            line = line.strip("•-▸ ").strip()
            if not line or line.lower().startswith("no "):
                continue
            if " - " not in line:
                continue
            time_str, title = line.split(" - ", 1)
            try:
                event_dt = datetime.strptime(f"{today} {time_str.strip()}", "%Y-%m-%d %H:%M")
            except ValueError:
                continue
            diff_min = (event_dt - now).total_seconds() / 60
            if 4.0 <= diff_min <= 6.0:
                key = f"{today}-{time_str.strip()}-{title[:40]}"
                if key not in _alerted_events:
                    _alerted_events.add(key)
                    title_clean = title.strip()
                    await _alert("CALENDAR REMINDER", f"Starting in 5 min: {title_clean}")
                    await _speak(f"Heads up — {title_clean} starts in 5 minutes.")
    except Exception:
        pass


# ── Email ─────────────────────────────────────────────────────────────────────

async def _email_check() -> None:
    global _last_email_count
    if _focus_active():
        return
    try:
        from agent.tools.gmail import list_emails  # type: ignore

        raw: str = await asyncio.to_thread(
            list_emails.invoke, {"max_results": 1, "query": "is:unread"}
        )
        if not isinstance(raw, str):
            return
        count = 0
        for line in raw.splitlines():
            if "unread" in line.lower():
                m = re.search(r"\d+", line)
                if m:
                    count = int(m.group())
                    break
        if _last_email_count >= 0 and count > _last_email_count:
            delta = count - _last_email_count
            label = "message" if delta == 1 else "messages"
            await _alert("NEW MAIL", f"{delta} new unread {label}")
        _last_email_count = count
    except Exception:
        pass


# ── Past-due tasks ────────────────────────────────────────────────────────────

async def _overdue_task_check() -> None:
    global _alerted_overdue
    try:
        from agent.tools.tasks import list_tasks  # type: ignore

        raw: str = await list_tasks.ainvoke({"status": "active"})
        if not isinstance(raw, str) or raw.lower().startswith("no task"):
            return

        today = datetime.now().strftime("%Y-%m-%d")
        for line in raw.splitlines():
            line = line.strip()
            if not line or "due" not in line.lower():
                continue
            id_m = re.search(r"\[(\d+)\]", line)
            due_m = re.search(r"due (\d{4}-\d{2}-\d{2})", line)
            if not id_m or not due_m:
                continue
            task_id = int(id_m.group(1))
            due_date = due_m.group(1)
            if due_date < today and task_id not in _alerted_overdue:
                _alerted_overdue.add(task_id)
                title_m = re.match(r"^•\s*\[\d+\]\s*[🔴🟡🟢⚪]?\s*(.*?)(?:\s*—\s*due)", line)
                title = title_m.group(1).strip() if title_m else f"Task {task_id}"
                await _alert("OVERDUE TASK", f"{title[:55]} (was due {due_date})")
    except Exception:
        pass


# ── System health (battery + CPU/RAM spikes) ──────────────────────────────────

async def _system_health_check() -> None:
    global _cpu_high_ticks, _ram_high_ticks
    global _battery_low_alerted, _battery_critical_alerted
    try:
        import psutil  # type: ignore

        cpu = await asyncio.to_thread(psutil.cpu_percent, 0.2)
        mem = psutil.virtual_memory()

        # CPU spike: alert after 3 consecutive ticks above 90%
        if cpu >= 90:
            _cpu_high_ticks += 1
            if _cpu_high_ticks == 3:
                await _alert("CPU SPIKE", f"CPU at {cpu:.0f}% — check running processes")
        else:
            _cpu_high_ticks = 0

        # RAM spike: alert after 3 consecutive ticks above 88%
        if mem.percent >= 88:
            _ram_high_ticks += 1
            if _ram_high_ticks == 3:
                await _alert("MEMORY CRITICAL", f"RAM at {mem.percent:.0f}% — consider closing apps")
        else:
            _ram_high_ticks = 0

        # Battery
        try:
            battery = psutil.sensors_battery()
            if battery:
                pct = battery.percent
                if battery.power_plugged:
                    _battery_low_alerted = False
                    _battery_critical_alerted = False
                else:
                    if pct <= 5 and not _battery_critical_alerted:
                        _battery_critical_alerted = True
                        await _alert("BATTERY CRITICAL", f"{pct:.0f}% — plug in immediately!")
                        await _speak(f"Battery critical at {pct:.0f} percent. Please plug in now.")
                    elif pct <= 20 and not _battery_low_alerted:
                        _battery_low_alerted = True
                        await _alert("BATTERY LOW", f"{pct:.0f}% remaining")
        except Exception:
            pass
    except Exception:
        pass


# ── Phone notifications (ADB) ─────────────────────────────────────────────────

async def _phone_notifications() -> None:
    global _seen_phone_notifs
    try:
        import subprocess

        # Quick devices check first
        chk = await asyncio.to_thread(
            subprocess.run,
            ["adb", "devices"],
            capture_output=True, text=True, timeout=4,
        )
        if not chk.stdout or chk.returncode != 0:
            return
        connected = [l for l in chk.stdout.splitlines() if "\tdevice" in l]
        if not connected:
            return

        # Dump notifications
        nr = await asyncio.to_thread(
            subprocess.run,
            ["adb", "shell", "dumpsys", "notification", "--noredact"],
            capture_output=True, text=True, timeout=8,
        )
        if not nr.stdout:
            return

        titles: list[str] = []
        for line in nr.stdout.splitlines():
            line = line.strip()
            if "android.title=" in line:
                raw_title = line.split("android.title=", 1)[1].strip().strip('"').strip("'")
                if raw_title and len(raw_title) > 1:
                    titles.append(raw_title[:60])

        # Cap seen set size so old notifications can surface again after a restart
        if len(_seen_phone_notifs) > 200:
            _seen_phone_notifs = set(list(_seen_phone_notifs)[-100:])

        new_titles = [t for t in titles if t not in _seen_phone_notifs]
        for title in new_titles[:3]:  # surface at most 3 per tick
            _seen_phone_notifs.add(title)
            await _alert("PHONE", title)
    except FileNotFoundError:
        pass  # adb not installed
    except Exception:
        pass


# ── Morning briefing ──────────────────────────────────────────────────────────

async def _morning_check() -> None:
    global _briefing_date
    try:
        from routers.hologram import manager  # type: ignore

        now = datetime.now()
        today = now.strftime("%Y-%m-%d")
        if _briefing_date == today or not (7 <= now.hour < 10) or manager.count == 0:
            return
        _briefing_date = today
        await _alert("GOOD MORNING", "EDITH ONLINE · SAY MORNING BRIEFING")
        await _speak("Good morning. EDITH systems are online. Say morning briefing for your daily update.")
    except Exception:
        pass


# ── End-of-day summary prompt ─────────────────────────────────────────────────

async def _end_of_day_check() -> None:
    global _eod_date
    try:
        from routers.hologram import manager  # type: ignore

        now = datetime.now()
        today = now.strftime("%Y-%m-%d")
        if _eod_date == today or not (18 <= now.hour < 20) or manager.count == 0:
            return
        _eod_date = today
        await _alert("END OF DAY", "SAY DAILY SUMMARY FOR TODAY'S REPORT")
        await _speak("End of day. Say daily summary for a rundown of what you accomplished today.")
    except Exception:
        pass


# ── Main loop ─────────────────────────────────────────────────────────────────

async def run() -> None:
    tick = 0
    while True:
        await asyncio.sleep(60)
        tick += 1
        try:
            await _morning_check()
            await _calendar_check()
            await _system_health_check()
            await _end_of_day_check()
            if tick % 3 == 0:
                await _phone_notifications()
            if tick % 5 == 0:
                await _email_check()
                await _overdue_task_check()
        except Exception:
            pass

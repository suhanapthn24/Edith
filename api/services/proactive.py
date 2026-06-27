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
_prep_events: set[str] = set()
_last_email_count: int = -1
_extracted_email_subjs: set[str] = set()
_alerted_overdue: set[int] = set()
_cpu_high_ticks: int = 0
_ram_high_ticks: int = 0
_battery_low_alerted: bool = False
_battery_critical_alerted: bool = False
_briefing_date: str = ""
_eod_date: str = ""
_standup_date: str = ""
_journal_date: str = ""
_habit_date: str = ""
_weekly_review_date: str = ""
_email_batch: list[str] = []
_email_batch_last: datetime | None = None
_downloads_seen: set[str] = set()
_downloads_initialized: bool = False
_context_restore_idle_prev: float = 0.0
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


# ── Meeting prep (10-min advance) ────────────────────────────────────────────

async def _meeting_prep() -> None:
    """Fire ~10 min before events: pull related emails + KB notes and brief the user."""
    global _prep_events
    try:
        from agent.tools.google_calendar import list_calendar_events  # type: ignore
        from agent.tools.gmail import list_emails  # type: ignore
        from agent.tools.rag import search_knowledge  # type: ignore

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
            if 9.0 <= diff_min <= 11.0:
                key = f"prep-{today}-{time_str.strip()}-{title[:40]}"
                if key in _prep_events:
                    continue
                _prep_events.add(key)
                title_clean = title.strip()
                context_parts: list[str] = []

                # Pull emails with subject matching first keyword of event title
                keyword = title_clean.split()[0][:20] if title_clean.split() else ""
                try:
                    emails_raw: str = await asyncio.to_thread(
                        list_emails.invoke,
                        {"max_results": 3, "query": f"subject:{keyword}"},
                    )
                    if isinstance(emails_raw, str) and "not connected" not in emails_raw.lower():
                        subjs = [l.strip().lstrip("•-▸ ").strip()[:60]
                                 for l in emails_raw.splitlines()
                                 if l.strip() and l.strip()[0] in "•-▸"]
                        if subjs:
                            context_parts.append(f"Emails: {'; '.join(subjs[:2])}")
                except Exception:
                    pass

                # Search knowledge base for event title
                try:
                    kb_raw: str = await asyncio.to_thread(
                        search_knowledge.invoke,
                        {"query": title_clean, "max_results": 2},
                    )
                    if isinstance(kb_raw, str) and "no results" not in kb_raw.lower():
                        first = next((l.strip() for l in kb_raw.splitlines() if l.strip()), "")
                        if first:
                            context_parts.append(f"Notes: {first[:60]}")
                except Exception:
                    pass

                summary = " · ".join(context_parts) if context_parts else "No related items found."
                await _alert("MEETING PREP", f"{title_clean} in 10 min · {summary[:80]}")
                await _speak(
                    f"Meeting prep: {title_clean} starts in 10 minutes. {summary[:120]}"
                )
    except Exception:
        pass


# ── Auto-task extraction from email subjects ──────────────────────────────────

_ACTION_PHRASES = [
    "action required", "action needed", "please review", "urgent",
    "deadline", "reminder:", "follow up", "follow-up", "response needed",
    "please respond", "approval needed", "review needed", "asap",
]


async def _email_task_extraction(subjects: list[str]) -> None:
    """Create tasks from email subjects that look like action items."""
    global _extracted_email_subjs
    try:
        from agent.tools.tasks import create_task  # type: ignore

        for subj in subjects[:5]:
            if subj in _extracted_email_subjs:
                continue
            if any(phrase in subj.lower() for phrase in _ACTION_PHRASES):
                _extracted_email_subjs.add(subj)
                if len(_extracted_email_subjs) > 500:
                    _extracted_email_subjs = set(list(_extracted_email_subjs)[-250:])
                await create_task.ainvoke({
                    "title": f"[Email] {subj[:70]}",
                    "priority": "high",
                    "notes": "Auto-created from action email",
                })
                await _alert("AUTO TASK", f"Action email: {subj[:55]}")
    except Exception:
        pass


# ── Auto window layout on event start ────────────────────────────────────────

async def _auto_apply_layout(event_title: str) -> None:
    """Restore a saved layout whose name appears in the event title, silently."""
    try:
        import json
        from pathlib import Path

        layouts_file = Path.home() / ".edith_layouts.json"
        if not layouts_file.exists():
            return
        layouts: dict = json.loads(layouts_file.read_text())
        title_lower = event_title.lower()
        for layout_name, layout_data in layouts.items():
            words = layout_name.lower().split()
            if not any(w in title_lower for w in words):
                continue
            try:
                import pygetwindow as gw  # type: ignore
                restored = 0
                for saved in layout_data.get("windows", []):
                    matches = [w for w in gw.getAllWindows()
                               if saved["title"].lower() in w.title.lower() and w.title.strip()]
                    if matches:
                        w = matches[0]
                        if w.isMinimized:
                            w.restore()
                        w.moveTo(saved["left"], saved["top"])
                        w.resizeTo(saved["width"], saved["height"])
                        restored += 1
                if restored:
                    await _alert("LAYOUT", f"'{layout_name}' applied for {event_title[:35]}")
            except ImportError:
                pass
            break
    except Exception:
        pass


# ── Standup reminder ──────────────────────────────────────────────────────────

async def _standup_reminder() -> None:
    """Fire once at 9am: prompt user to generate standup."""
    global _standup_date
    try:
        from routers.hologram import manager  # type: ignore

        now = datetime.now()
        today = now.strftime("%Y-%m-%d")
        if _standup_date == today or now.hour != 9 or manager.count == 0:
            return
        _standup_date = today
        await _alert("STANDUP TIME", "SAY 'GENERATE STANDUP' TO DRAFT TODAY'S STANDUP")
        await _speak("It's standup time. Say generate standup to draft your daily update.")
    except Exception:
        pass


# ── Context restore on system wake ───────────────────────────────────────────

async def _context_restore() -> None:
    """Detect wake from lock/sleep: if idle was >5 min last tick and now active, restore workspace."""
    global _context_restore_idle_prev
    try:
        import ctypes

        class _LASTINPUTINFO(ctypes.Structure):
            _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]

        lii = _LASTINPUTINFO()
        lii.cbSize = ctypes.sizeof(_LASTINPUTINFO)
        ctypes.windll.user32.GetLastInputInfo(ctypes.byref(lii))
        millis = ctypes.windll.kernel32.GetTickCount() - lii.dwTime
        idle_sec = max(0.0, millis / 1000.0)

        if _context_restore_idle_prev > 300 and idle_sec < 60:
            from routers.hologram import manager  # type: ignore
            if manager.count > 0:
                await _alert("WELCOME BACK", "Restoring your workspace context...")
                await _speak("Welcome back. Restoring your workspace.")
                try:
                    import json
                    from pathlib import Path
                    layouts_file = Path.home() / ".edith_layouts.json"
                    if layouts_file.exists():
                        layouts: dict = json.loads(layouts_file.read_text())
                        if layouts:
                            last_name = list(layouts.keys())[-1]
                            from agent.tools.productivity import restore_window_layout  # type: ignore
                            await asyncio.to_thread(restore_window_layout.invoke, {"name": last_name})
                except Exception:
                    pass
                try:
                    from agent.tools.tasks import list_tasks  # type: ignore
                    tasks_raw: str = await list_tasks.ainvoke({"status": "active"})
                    if isinstance(tasks_raw, str):
                        task_lines = [
                            line.strip().lstrip("•-▸ ").strip()[:50]
                            for line in tasks_raw.splitlines()
                            if line.strip() and line.strip()[0] in "•-▸"
                        ][:3]
                        if task_lines:
                            await _speak("Your top tasks: " + ". ".join(task_lines))
                except Exception:
                    pass

        _context_restore_idle_prev = idle_sec
    except Exception:
        pass


# ── Downloads auto-organizer ──────────────────────────────────────────────────

_DOWNLOAD_RULES: list[tuple[tuple[str, ...], str]] = [
    ((".pdf",), "Documents/PDFs"),
    ((".doc", ".docx", ".odt", ".rtf"), "Documents/Word"),
    ((".xls", ".xlsx", ".csv"), "Documents/Spreadsheets"),
    ((".ppt", ".pptx"), "Documents/Presentations"),
    ((".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico"), "Images"),
    ((".mp4", ".mkv", ".avi", ".mov", ".webm"), "Videos"),
    ((".mp3", ".wav", ".flac", ".ogg", ".m4a"), "Music"),
    ((".zip", ".rar", ".7z", ".tar", ".gz", ".tar.gz"), "Archives"),
    ((".py", ".js", ".ts", ".html", ".css", ".json", ".yaml", ".yml",
      ".sh", ".bat", ".ps1", ".ipynb", ".md"), "Code"),
    ((".exe", ".msi"), "Installers"),
]


async def _organize_downloads() -> None:
    """Silently move new files in ~/Downloads to categorized subfolders."""
    global _downloads_seen, _downloads_initialized
    try:
        from pathlib import Path

        downloads = Path.home() / "Downloads"
        if not downloads.exists():
            return

        for f in downloads.iterdir():
            if not f.is_file():
                continue
            if f.name in _downloads_seen:
                continue
            _downloads_seen.add(f.name)
            if len(_downloads_seen) > 1000:
                _downloads_seen = set(list(_downloads_seen)[-500:])

            if not _downloads_initialized:
                continue  # first pass: index without moving

            suffix = f.suffix.lower()
            dest_rel: str | None = None
            for exts, folder in _DOWNLOAD_RULES:
                if suffix in exts:
                    dest_rel = folder
                    break

            if dest_rel is None:
                continue

            dest_dir = downloads / dest_rel
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / f.name
            if not dest.exists():
                f.rename(dest)
                await _alert("FILE ORGANIZED", f"{f.name[:40]} → Downloads/{dest_rel}/")

        _downloads_initialized = True
    except Exception:
        pass


# ── Nightly auto-journal ──────────────────────────────────────────────────────

async def _nightly_journal() -> None:
    """After 9 pm, compile today's focus + pending tasks into a daily journal file."""
    global _journal_date
    try:
        from pathlib import Path

        now = datetime.now()
        today = now.strftime("%Y-%m-%d")
        if _journal_date == today or now.hour < 21:
            return

        from agent.tools.productivity import _load_pomo_stats  # type: ignore

        stats = _load_pomo_stats()
        today_sessions = [s for s in stats.get("sessions", []) if s.get("date") == today]
        total_focus = sum(s.get("focus_min", 0) for s in today_sessions)
        total_cycles = sum(s.get("cycles", 0) for s in today_sessions)

        # Pending tasks
        pending: list[str] = []
        try:
            from agent.tools.tasks import list_tasks  # type: ignore
            tasks_raw: str = await list_tasks.ainvoke({"status": "active"})
            if isinstance(tasks_raw, str):
                for line in tasks_raw.splitlines():
                    m = re.match(r"^•\s*\[\d+\]\s*[🔴🟡🟢⚪]?\s*(.*?)(?:\s*—|$)", line.strip())
                    if m:
                        pending.append(m.group(1).strip()[:60])
        except Exception:
            pass

        lines = [
            f"# Journal — {today}",
            "",
            "## Focus",
            f"- Sessions: {len(today_sessions)}",
            f"- Cycles: {total_cycles}",
            f"- Total: {total_focus}min ({total_focus//60}h {total_focus%60}m)",
            "",
            "## Pending for tomorrow",
        ]
        lines += ([f"- {t}" for t in pending[:8]] if pending else ["- Nothing pending"])
        lines += ["", f"*EDITH · {now.strftime('%H:%M')}*"]

        journal_dir = Path.home() / ".edith_journal"
        journal_dir.mkdir(exist_ok=True)
        (journal_dir / f"{today}.md").write_text("\n".join(lines), encoding="utf-8")

        _journal_date = today
        await _alert("JOURNAL SAVED", f"~/.edith_journal/{today}.md · {total_focus}min focus today")
    except Exception:
        pass


# ── Weekly review generator ──────────────────────────────────────────────────

async def _weekly_review() -> None:
    """Every Friday after 6pm: compile week's focus + completed tasks into a journal file."""
    global _weekly_review_date
    try:
        from pathlib import Path

        now = datetime.now()
        if now.weekday() != 4 or now.hour < 18:  # 4 = Friday
            return
        week_key = now.strftime("%Y-W%W")
        if _weekly_review_date == week_key:
            return

        from agent.tools.productivity import _load_pomo_stats  # type: ignore

        stats = _load_pomo_stats()
        today = now.strftime("%Y-%m-%d")
        week_dates = [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
        week_sessions = [s for s in stats.get("sessions", []) if s.get("date", "") in week_dates]

        total_focus = sum(s.get("focus_min", 0) for s in week_sessions)
        total_cycles = sum(s.get("cycles", 0) for s in week_sessions)
        by_day: dict[str, int] = {}
        for s in week_sessions:
            d = s.get("date", "")
            by_day[d] = by_day.get(d, 0) + s.get("focus_min", 0)

        done_tasks: list[str] = []
        try:
            from agent.tools.tasks import list_tasks  # type: ignore
            tasks_raw: str = await list_tasks.ainvoke({"status": "done"})
            if isinstance(tasks_raw, str):
                for line in tasks_raw.splitlines():
                    m = re.match(r"^•\s*\[\d+\]\s*[🔴🟡🟢⚪]?\s*(.*?)(?:\s*—|$)", line.strip())
                    if m:
                        done_tasks.append(m.group(1).strip()[:60])
        except Exception:
            pass

        journal_dir = Path.home() / ".edith_journal"
        journal_days = [f"- {d}: journal exists" for d in week_dates if (journal_dir / f"{d}.md").exists()]

        lines = [
            f"# Weekly Review — {week_key} (ending {today})",
            "",
            "## Focus",
            f"- Total: {total_focus}min ({total_focus//60}h {total_focus%60}m)",
            f"- Cycles: {total_cycles}  ·  Active days: {len(by_day)}",
        ]
        if by_day:
            lines.append("- Daily breakdown:")
            for d in sorted(by_day):
                m = by_day[d]
                lines.append(f"  - {d}: {m}min ({m//60}h {m%60}m)")
        lines += ["", "## Completed this week"]
        lines += ([f"- {t}" for t in done_tasks[:15]] if done_tasks else ["- (none)"])
        lines += ["", "## Daily journals written"]
        lines += (journal_days if journal_days else ["- None"])
        lines += ["", f"*EDITH Weekly Review · {now.strftime('%H:%M')}*"]

        journal_dir.mkdir(exist_ok=True)
        (journal_dir / f"{week_key}.md").write_text("\n".join(lines), encoding="utf-8")
        _weekly_review_date = week_key
        await _alert("WEEKLY REVIEW", f"~/.edith_journal/{week_key}.md · {total_focus}min focus this week")
        await _speak(f"Weekly review saved. You focused {total_focus} minutes this week.")
    except Exception:
        pass


# ── Daily habit check-in ──────────────────────────────────────────────────────

async def _habit_checkin() -> None:
    """Once at 8pm: prompt habit check-in and append to today's journal if it exists."""
    global _habit_date
    try:
        from routers.hologram import manager  # type: ignore

        now = datetime.now()
        today = now.strftime("%Y-%m-%d")
        if _habit_date == today or now.hour != 20 or manager.count == 0:
            return
        _habit_date = today

        await _alert(
            "HABIT CHECK-IN",
            "Did you exercise? · Drink enough water? · Read / learn today?"
        )
        await _speak(
            "Daily habit check-in. Did you exercise, drink enough water, and read or learn something today?"
        )

        from pathlib import Path
        journal_file = Path.home() / ".edith_journal" / f"{today}.md"
        if journal_file.exists():
            note = (
                "\n\n## Habit Check-in\n"
                "- Exercise: ?\n"
                "- Water: ?\n"
                "- Read / Learn: ?\n"
                f"*Prompted at {now.strftime('%H:%M')}*"
            )
            with open(journal_file, "a", encoding="utf-8") as fh:
                fh.write(note)
    except Exception:
        pass


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
                    await _auto_apply_layout(title_clean)
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
            list_emails.invoke, {"max_results": 5, "query": "is:unread"}
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

        subjects = [
            line.strip().lstrip("•-▸ ").strip()[:80]
            for line in raw.splitlines()
            if line.strip() and line.strip()[0] in "•-▸"
        ]

        if _last_email_count >= 0 and count > _last_email_count:
            new_subjects = subjects[:count - _last_email_count]
            action_subjs = [s for s in new_subjects if any(p in s.lower() for p in _ACTION_PHRASES)]
            passive_subjs = [s for s in new_subjects if s not in action_subjs]

            if action_subjs:
                delta = len(action_subjs)
                label = "action email" if delta == 1 else "action emails"
                await _alert("NEW MAIL", f"{delta} new {label}: {action_subjs[0][:45]}")
                await _email_task_extraction(action_subjs)
            if passive_subjs:
                _email_batch.extend(s for s in passive_subjs if s not in _email_batch)

        # Flush passive email batch every 2 hours
        global _email_batch_last
        now_dt = datetime.now()
        if _email_batch and (
            _email_batch_last is None
            or (now_dt - _email_batch_last).total_seconds() >= 7200
        ):
            batch_copy = _email_batch[:8]
            _email_batch.clear()
            _email_batch_last = now_dt
            summary = " · ".join(s[:40] for s in batch_copy[:3])
            extra = f" (+{len(batch_copy)-3} more)" if len(batch_copy) > 3 else ""
            await _alert("EMAIL DIGEST", f"{len(batch_copy)} emails: {summary}{extra}")

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
            await _standup_reminder()
            await _meeting_prep()
            await _calendar_check()
            await _context_restore()
            await _system_health_check()
            await _end_of_day_check()
            await _habit_checkin()
            await _nightly_journal()
            await _weekly_review()
            if tick % 3 == 0:
                await _phone_notifications()
            if tick % 5 == 0:
                await _email_check()
                await _overdue_task_check()
            if tick % 10 == 0:
                await _organize_downloads()
        except Exception:
            pass

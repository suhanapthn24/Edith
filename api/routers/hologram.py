"""
Hologram display endpoints — serves aggregated live data to hologram.html.

WebSocket : /ws/hologram  (registered as alias in main.py)
REST      : GET /api/v1/hologram/data
"""

import asyncio
import json
import os
import re
from datetime import datetime
from typing import Any

import httpx
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/api/v1/hologram", tags=["hologram"])


# ── Connection Manager ──────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self) -> None:
        self._clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.discard(ws)

    async def broadcast(self, payload: dict) -> None:
        dead: set[WebSocket] = set()
        msg = json.dumps(payload)
        for ws in list(self._clients):
            try:
                await ws.send_text(msg)
            except Exception:
                dead.add(ws)
        self._clients.difference_update(dead)

    @property
    def count(self) -> int:
        return len(self._clients)


manager = ConnectionManager()


# ── Shared state (new connections receive this immediately on connect) ───────

_state: dict[str, Any] = {
    "calendar": [],
    "gmail": {"unread": 0, "latest": []},
    "spotify": None,
    "weather": {},
    "services": {},
    "edith_speaking": False,
    "system_stats": {},
    "news": [],
    "crypto": {},
    "tasks": [],
}

_broadcast_task: asyncio.Task | None = None
_stats_task: asyncio.Task | None = None
_last_net = None


# ── Public trigger API (call from anywhere in the codebase) ─────────────────

async def set_speaking(active: bool) -> None:
    """Call when EDITH starts or stops speaking to update all displays."""
    _state["edith_speaking"] = active
    await manager.broadcast({"type": "update", **_state})


async def trigger_gmail_update() -> None:
    """Call when a new email arrives."""
    result = await _get_gmail()
    _state["gmail"] = result or {"unread": 0, "latest": []}
    await manager.broadcast({"type": "update", **_state})


async def trigger_calendar_alert() -> None:
    """Call when a calendar event is starting within 5 minutes."""
    result = await _get_calendar()
    _state["calendar"] = result or []
    await manager.broadcast({"type": "update", **_state})


async def trigger_alert(title: str, message: str) -> None:
    """Push an alert toast to all connected hologram displays."""
    await manager.broadcast({"type": "alert", "title": title, "message": message})


# ── Background 30-second auto-broadcast ─────────────────────────────────────

async def _auto_broadcast() -> None:
    while True:
        await asyncio.sleep(30)
        try:
            if manager.count == 0:
                continue
            data = await _collect_data()
            _state.update(data)
            await manager.broadcast({"type": "update", **_state})
        except Exception:
            pass


# ── Background 5-second system stats push ───────────────────────────────────

async def _stats_broadcast() -> None:
    global _last_net
    while True:
        await asyncio.sleep(5)
        try:
            if manager.count == 0:
                continue
            stats = await _get_system_stats()
            if stats:
                _state["system_stats"] = stats
                await manager.broadcast({"type": "stats", **stats})
        except Exception:
            pass


# ── WebSocket endpoint ───────────────────────────────────────────────────────

async def hologram_ws(websocket: WebSocket) -> None:
    global _broadcast_task, _stats_task
    await manager.connect(websocket)

    # Start background broadcast tasks if not already running
    if _broadcast_task is None or _broadcast_task.done():
        _broadcast_task = asyncio.create_task(_auto_broadcast())
    if _stats_task is None or _stats_task.done():
        _stats_task = asyncio.create_task(_stats_broadcast())

    try:
        # Fetch fresh data on first ever connection; reuse cached state after
        if not _state["services"]:
            data = await _collect_data()
            _state.update(data)
        await websocket.send_text(json.dumps({"type": "update", **_state}))

        # Keep-alive ping loop
        while True:
            await asyncio.sleep(45)
            await websocket.send_text('{"type":"ping"}')
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.disconnect(websocket)


# ── REST snapshot endpoint ───────────────────────────────────────────────────

@router.get("/data")
async def hologram_data() -> dict:
    """One-shot JSON snapshot — fallback when WebSocket is unavailable."""
    data = await _collect_data()
    _state.update(data)
    return {"type": "update", **_state}


# ── Aggregate collector ──────────────────────────────────────────────────────

async def _collect_data() -> dict[str, Any]:
    results = await asyncio.gather(
        _get_calendar(),
        _get_gmail(),
        _get_spotify(),
        _get_weather(),
        _get_services(),
        _get_news(),
        _get_crypto(),
        _get_tasks(),
        return_exceptions=True,
    )
    calendar, gmail, spotify, weather, services, news, crypto, tasks = [
        r if not isinstance(r, Exception) else None for r in results
    ]
    return {
        "calendar": calendar or [],
        "gmail": gmail or {"unread": 0, "latest": []},
        "spotify": spotify,
        "weather": weather or {},
        "services": services or {},
        "news": news or [],
        "crypto": crypto or {},
        "tasks": tasks or [],
        "edith_speaking": _state.get("edith_speaking", False),
    }


# ── Individual collectors ────────────────────────────────────────────────────

async def _get_calendar() -> list:
    try:
        from agent.tools.google_calendar import list_calendar_events  # type: ignore
        today = datetime.now().strftime("%Y-%m-%d")
        raw: str = await asyncio.to_thread(list_calendar_events.invoke, {"date": today})
        if not isinstance(raw, str) or raw.lower().startswith("error"):
            return []
        events = []
        for line in raw.splitlines():
            line = line.strip("•-▸ ").strip()
            if not line or line.lower().startswith("no "):
                continue
            parts = line.split(" - ", 1) if " - " in line else [None, line]
            events.append({
                "time": (parts[0] or "").strip(),
                "title": (parts[1] or line).strip(),
            })
        return events[:5]
    except Exception:
        return []


async def _get_gmail() -> dict:
    try:
        from agent.tools.gmail import list_emails  # type: ignore
        raw: str = await asyncio.to_thread(
            list_emails.invoke, {"max_results": 5, "query": "is:unread"}
        )
        if not isinstance(raw, str) or "error" in raw.lower() or "not connected" in raw.lower():
            return {"unread": 0, "latest": []}

        unread = 0
        for line in raw.splitlines():
            if "unread" in line.lower():
                m = re.search(r"\d+", line)
                if m:
                    unread = int(m.group())
                    break

        subjects = []
        for line in raw.splitlines():
            stripped = line.strip()
            if stripped and (stripped[0] in "•-▸" or stripped[:2] in ("- ", "* ")):
                subjects.append(stripped.lstrip("•-▸* ").strip()[:60])

        return {"unread": unread or len(subjects), "latest": subjects[:3]}
    except Exception:
        return {"unread": 0, "latest": []}


async def _get_spotify() -> dict | None:
    try:
        from agent.tools.spotify import get_current_track  # type: ignore
        raw: str = await asyncio.to_thread(get_current_track.invoke, {})
        if not isinstance(raw, str):
            return None
        raw_l = raw.lower()
        if "nothing is currently" in raw_l or "not connected" in raw_l or raw_l.startswith("error"):
            return None

        result: dict = {}

        # Actual format: "Playing: Track Name by Artist" or "Paused: Track Name by Artist"
        if raw.startswith(("Playing:", "Paused:")):
            is_playing = raw.startswith("Playing:")
            rest = raw.split(":", 1)[1].strip()
            if " by " in rest:
                name_part, artist_part = rest.rsplit(" by ", 1)
                result["song"] = name_part.strip()
                result["artist"] = artist_part.strip()
            else:
                result["song"] = rest
            result["playing"] = is_playing
            return result if result.get("song") else None

        # Fallback: pipe-delimited "Song: X | Artist: Y | Progress: Z%"
        for part in raw.split("|"):
            part = part.strip()
            if ":" not in part:
                continue
            k, v = part.split(":", 1)
            k = k.strip().lower()
            v = v.strip()
            if "song" in k or "track" in k:
                result["song"] = v
            elif "artist" in k:
                result["artist"] = v
            elif "progress" in k:
                try:
                    result["progress"] = float(v.strip("%")) / 100
                except Exception:
                    pass
        return result if result.get("song") else None
    except Exception:
        return None


async def _get_weather() -> dict:
    try:
        from config import settings as _cfg  # type: ignore
        key = _cfg.WEATHER_API_KEY
    except Exception:
        key = os.getenv("WEATHER_API_KEY")
    if not key:
        return {}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            city = os.getenv("WEATHER_CITY", "Pune,IN")
            r = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"q": city, "units": "metric", "appid": key},
            )
        if r.status_code == 200:
            d = r.json()
            return {
                "temp": f"{d['main']['temp']:.0f}°C",
                "condition": d["weather"][0]["description"].title(),
                "humidity": f"{d['main']['humidity']}%",
                "wind": f"{d['wind']['speed']:.1f} km/h",
            }
    except Exception:
        pass
    return {}


async def _get_news() -> list:
    """Fetch top 5 Hacker News stories (no API key needed)."""
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            top = await client.get("https://hacker-news.firebaseio.com/v0/topstories.json")
            ids = top.json()[:8]
            stories = []
            for sid in ids:
                r = await client.get(f"https://hacker-news.firebaseio.com/v0/item/{sid}.json")
                d = r.json()
                if d and d.get("title"):
                    stories.append({
                        "title": d["title"][:80],
                        "url": d.get("url", f"https://news.ycombinator.com/item?id={sid}"),
                        "score": d.get("score", 0),
                    })
                if len(stories) >= 5:
                    break
        return stories
    except Exception:
        return []


async def _get_crypto() -> dict:
    """Fetch BTC, ETH, SOL prices from CoinGecko (free, no key)."""
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": "bitcoin,ethereum,solana", "vs_currencies": "usd",
                        "include_24hr_change": "true"},
            )
        if r.status_code == 200:
            d = r.json()
            result = {}
            symbols = {"bitcoin": "BTC", "ethereum": "ETH", "solana": "SOL"}
            for coin_id, sym in symbols.items():
                if coin_id in d:
                    price = d[coin_id].get("usd", 0)
                    change = d[coin_id].get("usd_24h_change", 0)
                    result[sym] = {
                        "price": f"${price:,.0f}" if price >= 1 else f"${price:.4f}",
                        "change": f"{change:+.1f}%",
                        "up": change >= 0,
                    }
            return result
    except Exception:
        pass
    return {}


async def _get_tasks() -> list:
    """Fetch active tasks from the local SQLite database."""
    try:
        from agent.tools.tasks import list_tasks  # type: ignore
        raw: str = await list_tasks.ainvoke({"status": "active"})
        if not isinstance(raw, str) or raw.lower().startswith("no task"):
            return []
        tasks = []
        for line in raw.splitlines():
            line = line.strip()
            if not line or not line.startswith("•"):
                continue
            high = "🔴" in line
            m = re.match(r"^•\s*\[\d+\]\s*[🔴🟡🟢⚪]?\s*(.*)", line)
            text = m.group(1) if m else line.lstrip("• ")
            title = re.sub(r"\s*—\s*due\s+\S+", "", text)
            title = re.sub(r"\s*\[\w+\]\s*$", "", title).strip()
            if title:
                tasks.append({"title": title[:70], "high": high})
        return tasks[:6]
    except Exception:
        return []


async def _get_system_stats() -> dict:
    global _last_net
    try:
        import psutil
        cpu = await asyncio.to_thread(psutil.cpu_percent, 0.2)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("C:\\")
        net = psutil.net_io_counters()

        up_bytes = dn_bytes = 0
        if _last_net is not None:
            up_bytes = max(0, net.bytes_sent - _last_net.bytes_sent)
            dn_bytes = max(0, net.bytes_recv - _last_net.bytes_recv)
        _last_net = net

        def fmt(b: int) -> str:
            bps = b / 5
            if bps >= 1_000_000:
                return f"{bps/1e6:.1f}MB/s"
            if bps >= 1_000:
                return f"{bps/1000:.0f}KB/s"
            return f"{int(bps)}B/s"

        active = ""
        try:
            import pygetwindow as gw  # type: ignore
            w = await asyncio.to_thread(gw.getActiveWindow)
            if w and getattr(w, "title", ""):
                active = w.title[:60]
        except Exception:
            pass

        return {
            "cpu": round(cpu, 1),
            "ram": round(mem.percent, 1),
            "disk": round(disk.percent, 1),
            "net_up": fmt(up_bytes),
            "net_dn": fmt(dn_bytes),
            "active_window": active,
        }
    except Exception:
        return {}


async def _get_services() -> dict:
    svc: dict[str, bool] = {"api": True}

    # Google — calendar and gmail share the same token file
    connected = False
    try:
        if os.path.exists("google_tokens.json"):
            import json as _j
            with open("google_tokens.json") as f:
                tok = _j.load(f)
            connected = bool(tok.get("token") or tok.get("access_token"))
    except Exception:
        pass
    svc.update(google=connected, calendar=connected, gmail=connected)

    # Spotify (token file is spotify_tokens.json — plural)
    svc["spotify"] = os.path.exists("spotify_tokens.json")

    # LLM — key or local model configured
    try:
        from config import settings  # type: ignore
        svc["llm"] = bool(
            getattr(settings, "OPENAI_API_KEY", None)
            or getattr(settings, "OLLAMA_MODEL", None)
        )
    except Exception:
        svc["llm"] = False

    # RAG — ChromaDB accessible
    try:
        import chromadb  # type: ignore
        chromadb.PersistentClient(path="./chroma_db").list_collections()
        svc["rag"] = True
    except Exception:
        svc["rag"] = False

    return svc

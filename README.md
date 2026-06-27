# EDITH — Personal AI Operating System

A voice-first personal AI assistant. Talk to it like a chief of staff — it handles your calendar, email, music, tasks, reminders, maps, weather, system control, and more through natural conversation and voice commands.

## Features

### Voice pipeline
- **Always-on wake word** — "Edith", "hey Edith", "ok Edith" — continuous browser STT, no button needed
- **Speech interruption** — say "stop", "wait", or "Edith" mid-sentence to interrupt EDITH while she's speaking
- **Local offline STT** — optional Whisper endpoint (`/api/v1/stt`) replaces browser STT; auto-detected at startup
- **Multi-language** — cycle EN / HI / ES / FR / DE / JA from the hologram UI; applies to both STT and TTS
- **Global hotkey** — `Ctrl+Shift+E` from any app wakes EDITH; `Ctrl+Shift+S` stops speech
- **Persistent session** — conversation context survives page refreshes

### Holographic display (`hologram.html`)
- Live panels: weather, calendar, Spotify, Gmail, system stats, tasks, news, crypto
- Draggable panels with localStorage position persistence; double-click label to reset
- Pomodoro overlay bar showing cycle, state and countdown
- Toast alerts with optional TTS for proactive events
- MediaPipe gesture controls (swipe, pinch, palm)
- Hologram pyramid flip toggle

### Proactive intelligence (runs every 60 s in background)
- **Morning briefing** — auto-fires 7–10 am on first daily load
- **Calendar reminders** — speaks "X starts in 5 minutes" proactively
- **Email arrival** — alerts when unread count rises (suppressed during focus mode)
- **Overdue tasks** — alerts once per task when due date passes
- **Battery warnings** — low (≤20%) and critical (≤5%) alerts
- **CPU / RAM spikes** — alerts after 3 consecutive ticks above threshold
- **Phone notifications** — mirrors Android notification titles via ADB
- **End-of-day summary** — prompts "say daily summary" at 6–8 pm

### Productivity
- **Focus mode** — starts Pomodoro, suppresses email/notification alerts for the session
- **Pomodoro timer** — hologram overlay, WebSocket state updates, session recording
- **Pomodoro stats** — `get_pomodoro_stats(days=7)` — focus time, cycles, daily average
- **Daily briefing** — morning snapshot: battery, CPU/RAM, prompts for calendar/email/weather
- **Daily summary** — end-of-day: focus time from today's sessions, prompts for tasks/email
- **Clipboard history** — 20-item auto-captured rolling history
- **Text snippets** — save + expand reusable text blocks
- **Window layouts** — save and restore multi-window arrangements

### System control
- Open/close apps, files, folders
- Volume, brightness, power, lock, screenshot
- Window management: focus, resize, move, mouse/keyboard automation
- Screen recording (MP4 to Desktop)
- WiFi management, printing
- Battery, mic, process management
- AI vision / OCR (describe screen, extract text, find elements)
- Shell / `run_command`

### Integrations
- **Tasks & Reminders** — local SQLite CRUD
- **Google Calendar, Gmail, Contacts** — OAuth 2.0
- **Spotify** — search, play, queue, control
- **Weather** — current + forecast (OpenWeatherMap)
- **Maps & Directions** — Google Maps API
- **Web, YouTube, Maps** — open in browser
- **ADB (Android)** — screenshot, tap, type, SMS, notifications, file push/pull
- **Smart home** — Home Assistant REST API (`HA_URL` + `HA_TOKEN` in `.env`)
- **VS Code context** — push file/error context from terminal → EDITH chat session
- **Dev tools** — Docker, Git, HTTP, open ports, ping
- **Knowledge base** — RAG over personal notes (ChromaDB, `add_note` / `search_knowledge`)

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Hologram display | Vanilla HTML/JS/CSS (`hologram.html`) |
| Backend | FastAPI, LangGraph ReAct, Python 3.12 |
| LLM | `google/gemini-2.5-flash` via OpenRouter |
| Database | PostgreSQL (main) + SQLite (tasks/reminders/knowledge) |
| Voice | Web Speech API + optional Whisper (local) |
| Auth | Google OAuth 2.0, Spotify OAuth 2.0, Clerk |

## Project Structure

```
.
├── api/
│   ├── agent/
│   │   ├── apex.py                  # LangGraph ReAct agent + SYSTEM prompt
│   │   └── tools/
│   │       ├── tasks.py             # SQLite tasks
│   │       ├── reminders.py         # SQLite reminders
│   │       ├── google_calendar.py   # Google Calendar
│   │       ├── gmail.py             # Gmail
│   │       ├── spotify.py           # Spotify playback
│   │       ├── browser.py           # Web / YouTube / Maps
│   │       ├── weather.py
│   │       ├── google_contacts.py
│   │       ├── rag.py               # ChromaDB knowledge base
│   │       ├── system_nav.py        # Apps, files, volume, power
│   │       ├── window_manager.py    # Windows, mouse, keyboard
│   │       ├── advanced_control.py  # Screen recording, WiFi, print
│   │       ├── ai_vision.py         # Screen analysis, OCR
│   │       ├── system_extras.py     # Battery, mic, processes
│   │       ├── productivity.py      # Pomodoro, focus mode, snippets, layouts, stats
│   │       ├── dev_tools.py         # Docker, Git, HTTP, ports
│   │       ├── adb_control.py       # Android phone (ADB)
│   │       ├── smart_home.py        # Home Assistant REST API
│   │       └── calls.py
│   ├── routers/
│   │   ├── chat.py                  # SSE streaming chat
│   │   ├── hologram.py              # WebSocket data feed + proactive triggers
│   │   ├── stt.py                   # Local Whisper STT endpoint
│   │   ├── vscode.py                # VS Code context push
│   │   ├── google_auth.py
│   │   ├── spotify_auth.py
│   │   └── calls.py
│   ├── services/
│   │   ├── proactive.py             # Background scheduler (alerts, reminders, health)
│   │   ├── hotkey_daemon.py         # Global Ctrl+Shift+E / Ctrl+Shift+S hotkeys
│   │   ├── call_monitor.py
│   │   └── sm2.py
│   ├── config.py
│   ├── database.py
│   └── main.py
├── hologram.html                    # Standalone holographic display
├── edith/                           # Next.js 15 frontend dashboard
└── docker-compose.yml
```

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- [OpenRouter](https://openrouter.ai) account (free tier works)

### 1. Backend

```bash
cd api
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in keys:

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.5-flash

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...

WEATHER_API_KEY=...           # openweathermap.org
WEATHER_CITY=Pune,IN          # default city for hologram weather panel

GOOGLE_MAPS_API_KEY=...
YOUTUBE_API_KEY=...

# Optional — smart home
HA_URL=http://homeassistant.local:8123
HA_TOKEN=<long-lived access token from HA profile>

# Optional — local STT model (base/small/medium)
WHISPER_MODEL=base
```

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd edith
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Hologram display

Open `hologram.html` directly in Chrome (or any Chromium browser). It connects to `ws://localhost:8000/ws/hologram` automatically.

## Optional pip packages

| Package | Enables |
|---------|---------|
| `openai-whisper` | Local offline STT (`/api/v1/stt`) |
| `keyboard` | Global hotkeys (Ctrl+Shift+E / Ctrl+Shift+S) |
| `pygetwindow` | Window management, layout saves |
| `pyautogui` | Mouse/keyboard automation |
| `pyperclip` | Clipboard history |
| `mss` | Fast screenshots |
| `opencv-python` | Vision tools |
| `pytesseract` | OCR (also needs Tesseract binary) |
| `pycaw` | Audio device control |
| `faster-whisper` | Alternative faster STT backend |

Install all at once:
```bash
pip install openai-whisper keyboard pygetwindow pyautogui pyperclip mss opencv-python pycaw
```

## Connecting Integrations

### Google (Calendar, Gmail, Contacts)
1. [Google Cloud Console](https://console.cloud.google.com) → enable Gmail, Calendar, People APIs
2. Create OAuth 2.0 credentials; add redirect URI `http://localhost:8000/api/v1/auth/google/callback`
3. Visit `http://localhost:8000/api/v1/auth/google` and sign in once

### Spotify
1. [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → add redirect URI `http://127.0.0.1:8000/api/v1/auth/spotify/callback`
2. Visit `http://localhost:8000/api/v1/auth/spotify` and sign in once

### Android phone (ADB)
1. `winget install Google.PlatformTools`
2. Enable USB Debugging on phone → connect via USB or WiFi (`adb connect <phone-ip>:5555`)

### Home Assistant
1. Add `HA_URL` and `HA_TOKEN` to `api/.env`
2. Get token: Home Assistant → Profile → Long-Lived Access Tokens

### VS Code context push
Bind this to a VS Code task or terminal command to inject code context into EDITH's session:
```bash
# Push selected code/error to EDITH
curl -s -X POST http://localhost:8000/api/v1/vscode/context \
  -H "Content-Type: application/json" \
  -d '{"content": "<your code/error>", "file_path": "src/main.py", "message": "explain this error"}'
# Then say "EDITH explain this" in the hologram
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/chat/stream` | SSE streaming chat |
| `POST` | `/api/v1/chat/clear` | Clear session history |
| `POST` | `/api/v1/stt/` | Transcribe audio (Whisper) |
| `GET`  | `/api/v1/stt/health` | Check if local STT is available |
| `POST` | `/api/v1/vscode/context` | Push code/error context into session |
| `GET`  | `/api/v1/auth/google` | Start Google OAuth |
| `GET`  | `/api/v1/auth/spotify` | Start Spotify OAuth |
| `GET`  | `/health` | Health check |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `OPENROUTER_MODEL` | Yes | Model ID (e.g. `google/gemini-2.5-flash`) |
| `GOOGLE_CLIENT_ID` | For Google features | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For Google features | Google OAuth client secret |
| `SPOTIFY_CLIENT_ID` | For Spotify | Spotify OAuth client ID |
| `SPOTIFY_CLIENT_SECRET` | For Spotify | Spotify OAuth client secret |
| `WEATHER_API_KEY` | For weather | OpenWeatherMap API key |
| `WEATHER_CITY` | No | Default city (`City,CC` format, default `Pune,IN`) |
| `GOOGLE_MAPS_API_KEY` | For maps | Google Maps API key |
| `YOUTUBE_API_KEY` | For YouTube | YouTube Data API v3 key |
| `HA_URL` | For smart home | Home Assistant base URL |
| `HA_TOKEN` | For smart home | Home Assistant long-lived access token |
| `WHISPER_MODEL` | No | Whisper model size (`base`/`small`/`medium`, default `base`) |

# EDITH — Personal AI Operating System

A voice-first personal AI assistant. Talk to it like a chief of staff — it handles your calendar, email, music, tasks, reminders, maps, weather, and more through natural conversation and voice commands.

## Features

- **Voice activation** — Wake words: "Edith", "hey", "listen", "wake up", "wakey wakey"
- **Tasks & Reminders** — create, list, complete, and update (local SQLite)
- **Google Calendar** — list, create, and delete events via OAuth
- **Gmail** — list, read, and send emails via OAuth
- **Spotify** — search, play, queue, skip, pause, resume via OAuth
- **Maps & Directions** — distance + travel time via Google Maps API; opens maps on demand
- **Weather** — current conditions and multi-day forecast
- **Knowledge Base** — RAG over personal notes (ChromaDB)
- **Google Contacts** — call and message contacts (opens dialer/SMS)
- **Web & YouTube** — search and open results in browser

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Backend | FastAPI, LangGraph, Python 3.12 |
| LLM | `google/gemini-2.5-flash` via OpenRouter |
| Database | SQLite (tasks, reminders, knowledge base) |
| Voice | Web Speech API (browser-native) |
| Auth | Google OAuth 2.0, Spotify OAuth 2.0 |

## Project Structure

```
.
├── api/                        # FastAPI backend
│   ├── agent/                  # APEX — main ReAct agent
│   │   ├── apex.py             # LangGraph ReAct graph + system prompt
│   │   └── tools/              # 80+ tool implementations
│   │       ├── tasks.py / reminders.py          # Local SQLite
│   │       ├── google_calendar.py / gmail.py    # Google APIs
│   │       ├── spotify.py                       # Spotify playback
│   │       ├── browser.py                       # Web / YouTube / Maps
│   │       ├── weather.py / google_contacts.py
│   │       ├── rag.py                           # ChromaDB knowledge base
│   │       ├── system_nav.py                    # Apps, files, volume, power
│   │       ├── window_manager.py                # Windows, mouse, keyboard
│   │       ├── advanced_control.py              # Screen recording, WiFi, print
│   │       ├── ai_vision.py                     # Screen analysis, OCR
│   │       ├── system_extras.py                 # Battery, mic, processes
│   │       ├── productivity.py                  # Pomodoro, snippets, layouts
│   │       ├── dev_tools.py                     # Docker, Git, HTTP, ports
│   │       ├── adb_control.py                   # Android phone control
│   │       └── calls.py                         # Answer / decline calls
│   ├── agents/                 # Dashboard agents (DB-aware, Ollama)
│   │   ├── apex_agent.py       # Dashboard-scoped agent
│   │   └── tools/              # DSA, language, research DB tools
│   ├── routers/
│   │   ├── chat.py             # SSE streaming chat endpoint
│   │   ├── calls.py            # Incoming call notifications
│   │   ├── hologram.py         # Hologram WebSocket
│   │   ├── google_auth.py      # Google OAuth flow
│   │   ├── spotify_auth.py     # Spotify OAuth flow
│   │   ├── dsa.py / language.py / research.py  # Module CRUD
│   ├── models/                 # SQLAlchemy ORM (SQLite)
│   ├── schemas/                # Pydantic schemas
│   ├── services/
│   │   ├── call_monitor.py     # Background call-monitoring thread
│   │   └── sm2.py              # Spaced-repetition (SM-2) algorithm
│   ├── integrations/           # External API clients
│   ├── config.py               # Settings (pydantic-settings)
│   ├── database.py             # SQLAlchemy SQLite engine
│   └── main.py
├── edith/                      # Next.js 15 frontend
│   └── src/
│       ├── app/
│       │   ├── (dashboard)/    # Route group with shared layout
│       │   │   ├── dashboard / calendar / dsa / language /
│       │   │   ├── research / knowledge / career / skills
│       │   │   └── layout.tsx  # Sidebar + topbar shell
│       │   └── layout.tsx / globals.css
│       ├── components/
│       │   ├── chat/ChatWindow.tsx   # Voice, SSE streaming, UI
│       │   ├── dashboard/            # Briefing, streaks, progress widgets
│       │   └── layout/               # Navbar, sidebar
│       └── lib/
├── hologram.html               # Standalone hologram page
├── knowledge_base/             # Source files for RAG
└── docker-compose.yml
```

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- An [OpenRouter](https://openrouter.ai) account (free tier works)

### 1. Backend

```bash
cd api
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and fill in your keys:

```env
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.5-flash

GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...

WEATHER_API_KEY=...         # openweathermap.org
GOOGLE_MAPS_API_KEY=...     # Google Cloud Console
YOUTUBE_API_KEY=...         # Google Cloud Console
```

Start the server:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend

```bash
cd edith
npm install
```

Create `edith/.env.local`:

```env
NEXT_PUBLIC_MODEL_LABEL=gemini-2.5-flash
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Connecting Integrations

### Google (Calendar, Gmail, Contacts)

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create a project
2. Enable: **Gmail API**, **Google Calendar API**, **People API**
3. Create OAuth 2.0 credentials (Web application)
4. Add redirect URI: `http://localhost:8000/api/v1/auth/google/callback`
5. Visit `http://localhost:8000/api/v1/auth/google` — sign in once

### Spotify

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) → create an app
2. Add redirect URI: `http://127.0.0.1:8000/api/v1/auth/spotify/callback`
3. Visit `http://localhost:8000/api/v1/auth/spotify` — sign in once
4. Make sure Spotify is open on a device before playing music

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/chat/stream` | SSE streaming chat |
| `POST` | `/api/v1/chat/clear` | Clear session history |
| `GET` | `/api/v1/auth/google` | Start Google OAuth |
| `GET` | `/api/v1/auth/spotify` | Start Spotify OAuth |
| `GET` | `/health` | Health check |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `OPENROUTER_MODEL` | Yes | Model ID (e.g. `google/gemini-2.5-flash`) |
| `GOOGLE_CLIENT_ID` | For Google features | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | For Google features | Google OAuth client secret |
| `SPOTIFY_CLIENT_ID` | For Spotify | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | For Spotify | Spotify app client secret |
| `WEATHER_API_KEY` | For weather | OpenWeatherMap API key |
| `GOOGLE_MAPS_API_KEY` | For maps/directions | Google Maps API key |
| `YOUTUBE_API_KEY` | For YouTube search | YouTube Data API v3 key |

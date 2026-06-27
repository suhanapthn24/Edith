# EDITH — Folder Structure
### v2.0 · June 2026

```
d:\Projects\Learn with me\
│
├── README.md
├── docker-compose.yml              # PostgreSQL not used; kept for local services
├── hologram.html                   # Standalone hologram overlay page
├── knowledge_base/                 # Source files ingested into ChromaDB RAG
│
├── docs/                           # Design documents (this folder)
│
├── api/                            # FastAPI backend
│   ├── main.py                     # App entry, router registration, lifespan
│   ├── config.py                   # pydantic-settings (loaded from .env)
│   ├── database.py                 # SQLAlchemy async SQLite engine
│   ├── EDITH.db                    # SQLite — tasks, reminders, models, users
│   ├── apex.db                     # SQLite — apex agent conversation state
│   ├── chroma_db/                  # ChromaDB vector store (RAG embeddings)
│   ├── google_tokens.json          # Persisted Google OAuth tokens
│   ├── spotify_tokens.json         # Persisted Spotify OAuth tokens
│   ├── requirements.txt
│   │
│   ├── agent/                      # APEX — the main personal-OS ReAct agent
│   │   ├── apex.py                 # LangGraph ReAct graph + full system prompt
│   │   └── tools/                  # Tool implementations (80+ tools)
│   │       ├── __init__.py
│   │       ├── tasks.py            # CRUD tasks (SQLite)
│   │       ├── reminders.py        # CRUD reminders (SQLite)
│   │       ├── google_calendar.py  # List / create / delete calendar events
│   │       ├── gmail.py            # List / read / send email
│   │       ├── rag.py              # ChromaDB search + add note
│   │       ├── browser.py          # Web search, YouTube, Maps, directions
│   │       ├── spotify.py          # Search, play, queue, controls
│   │       ├── google_contacts.py  # Search, call, message contacts
│   │       ├── weather.py          # Current weather + forecast
│   │       ├── calls.py            # Answer / decline incoming calls
│   │       ├── system_nav.py       # Apps, files, volume, screenshot, power
│   │       ├── window_manager.py   # Windows, mouse, keyboard automation
│   │       ├── advanced_control.py # Screen recording, WiFi, printing
│   │       ├── ai_vision.py        # Screen analysis, OCR, region capture
│   │       ├── system_extras.py    # Battery, mic, processes, power plan
│   │       ├── productivity.py     # Pomodoro, snippets, layouts, briefing
│   │       ├── dev_tools.py        # Docker, Git, ports, HTTP requests
│   │       └── adb_control.py      # Android phone control via ADB
│   │
│   ├── agents/                     # Dashboard agents (DB-aware, Ollama)
│   │   ├── apex_agent.py           # Dashboard-scoped LangGraph agent
│   │   └── tools/                  # DB-reading tools for dashboard modules
│   │       ├── __init__.py
│   │       ├── dsa_tools.py        # NeetCode 150 progress queries
│   │       ├── language_tools.py   # SM-2 vocab + session queries
│   │       └── research_tools.py   # Research queue + stats queries
│   │
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── chat.py                 # SSE streaming chat → APEX agent
│   │   ├── calls.py                # Incoming call notification endpoint
│   │   ├── hologram.py             # Hologram REST + WebSocket endpoint
│   │   ├── google_auth.py          # Google OAuth flow + callback
│   │   ├── spotify_auth.py         # Spotify OAuth flow + callback
│   │   ├── dsa.py                  # NeetCode 150 CRUD
│   │   ├── language.py             # Language + vocab CRUD
│   │   └── research.py             # Research papers CRUD
│   │
│   ├── models/                     # SQLAlchemy ORM models
│   │   ├── __init__.py
│   │   ├── dsa.py
│   │   ├── language.py
│   │   ├── research.py
│   │   └── user.py
│   │
│   ├── schemas/                    # Pydantic request / response schemas
│   │   ├── dsa.py
│   │   ├── language.py
│   │   └── research.py
│   │
│   ├── services/
│   │   ├── call_monitor.py         # Background thread: monitors incoming calls
│   │   └── sm2.py                  # SM-2 spaced-repetition algorithm
│   │
│   ├── integrations/               # External API client wrappers
│   │   ├── dsa.py
│   │   ├── language.py
│   │   └── research.py
│   │
│   └── scripts/                    # One-off seed / migration scripts
│
└── edith/                          # Next.js 15 frontend
    └── src/
        ├── app/
        │   ├── layout.tsx          # Root layout (fonts, providers)
        │   ├── page.tsx            # Landing / redirect
        │   ├── globals.css         # Tailwind + CSS variables
        │   ├── api/                # Next.js API routes
        │   └── (dashboard)/        # Route group with shared shell
        │       ├── layout.tsx      # Sidebar + topbar layout
        │       ├── dashboard/page.tsx   # AI Life Dashboard
        │       ├── calendar/page.tsx
        │       ├── dsa/page.tsx         # NeetCode 150 tracker
        │       ├── language/page.tsx
        │       ├── research/page.tsx
        │       ├── knowledge/page.tsx
        │       ├── career/page.tsx
        │       └── skills/page.tsx
        │
        ├── components/
        │   ├── chat/
        │   │   └── ChatWindow.tsx       # Voice activation, SSE streaming, UI
        │   ├── dashboard/               # Dashboard widgets
        │   │   ├── briefing-card.tsx
        │   │   ├── calendar-preview.tsx
        │   │   ├── focus-list.tsx
        │   │   ├── language-progress.tsx
        │   │   ├── neetcode-progress.tsx
        │   │   ├── quick-stats.tsx
        │   │   └── streaks-row.tsx
        │   └── layout/
        │       └── navbar.tsx
        │
        └── lib/                    # Shared utilities, API client
```

## Key Design Points

- **No monorepo tooling** — `api/` and `edith/` are independent directories in the same repo.
- **SQLite, not PostgreSQL** — all persistent data (tasks, reminders, DSA progress, language models) lives in `EDITH.db`. Conversation state goes in `apex.db`.
- **ChromaDB for RAG** — knowledge base embeddings are stored in `chroma_db/` (local, no separate service).
- **Two agent systems:**
  - `agent/apex.py` — the personal-OS agent; handles everything via 80+ tools (system control, comms, productivity, dev, Android).
  - `agents/apex_agent.py` — a lighter dashboard agent that reads DB state to answer module-specific queries (DSA progress, vocab due, research queue).
- **Token files** — Google and Spotify OAuth tokens are persisted as JSON files; no database auth tables.
- **Hologram** — `hologram.html` (root) pairs with `routers/hologram.py` WebSocket for the AR overlay feature.

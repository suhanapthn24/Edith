# EDITH — System Architecture
### v2.0 · June 2026

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        EDITH PLATFORM                           │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              NEXT.JS 15 FRONTEND  (edith/)               │   │
│  │  Dashboard │ Calendar │ Language │ DSA │ Research         │   │
│  │  Knowledge │ Career   │ Skills   │ Chat Panel            │   │
│  └──────────────────────┬──────────────────────────────────┘   │
│                          │ HTTPS / SSE / WebSocket              │
│  ┌──────────────────────▼──────────────────────────────────┐   │
│  │               FASTAPI BACKEND  (api/)                    │   │
│  │                                                          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │  REST API   │  │  SSE Stream  │  │   WebSocket   │  │   │
│  │  │  Routers    │  │  /chat/stream│  │  /ws/hologram │  │   │
│  │  └──────┬──────┘  └──────┬───────┘  └──────┬────────┘  │   │
│  │         └────────────────┼─────────────────┘            │   │
│  │                          │                               │   │
│  │  ┌───────────────────────▼───────────────────────────┐  │   │
│  │  │               APEX ReAct AGENT                    │  │   │
│  │  │           agent/apex.py  (LangGraph)              │  │   │
│  │  │                                                   │  │   │
│  │  │  LLM: OpenRouter (gemini-2.5-flash, primary)      │  │   │
│  │  │       Ollama (qwen2.5:3b, fallback / offline)     │  │   │
│  │  │                                                   │  │   │
│  │  │  Tools (80+):                                     │  │   │
│  │  │  Tasks · Reminders · Google Calendar · Gmail      │  │   │
│  │  │  Spotify · Maps · Weather · Contacts · Browser    │  │   │
│  │  │  System Control · Window Manager · AI Vision      │  │   │
│  │  │  Dev Tools (Docker/Git) · ADB · Productivity      │  │   │
│  │  │  RAG Knowledge Base · Calls · WiFi · Printing     │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │           DASHBOARD AGENT  (agents/)               │  │   │
│  │  │    agents/apex_agent.py  (LangGraph, Ollama)       │  │   │
│  │  │    DB tools: DSA progress · vocab due · research   │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │  SQLite     │  │  ChromaDB    │  │  Token Files  │  │   │
│  │  │  EDITH.db   │  │  chroma_db/  │  │  google_      │  │   │
│  │  │  apex.db    │  │  (RAG embeds)│  │  spotify_     │  │   │
│  │  └─────────────┘  └──────────────┘  └───────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Background:  services/call_monitor.py  (OS call detection)     │
│                                                                 │
│  External APIs (used via agent tools):                          │
│  Google Calendar · Gmail · Spotify · Maps · OpenWeatherMap      │
│  OpenRouter (cloud LLM) · Ollama (local LLM + embeddings)       │
└─────────────────────────────────────────────────────────────────┘
```

## Request Flows

### Voice / Chat (typical)
```
User speaks → Web Speech API (browser) → ChatWindow.tsx
  → POST /api/v1/chat/stream (SSE)
  → APEX agent (apex.py)
  → LLM decides tool(s) to call
  → Tools execute → results fed back to LLM
  → Streams response tokens via SSE
  → ChatWindow renders tokens
```

### Simple CRUD (DSA, Language, Research)
```
User action → Next.js → FastAPI router (no auth middleware)
  → SQLAlchemy → EDITH.db (SQLite) → response
```

### RAG Knowledge Query
```
User asks question → APEX → search_knowledge(query)
  → query embedded via nomic-embed-text (Ollama)
  → ChromaDB cosine similarity → top-k chunks
  → LLM synthesizes answer from chunks
```

### Hologram Mode
```
Frontend loads hologram.html
  → connects WebSocket /ws/hologram
  → routers/hologram.py streams AI avatar / overlay data
```

### Background Call Monitor
```
services/call_monitor.py  (started on app lifespan)
  → polls OS for incoming calls
  → POSTs to /api/v1/calls/notify
  → APEX agent can answer_call() / decline_call()
```

## Technology Rationale by Layer

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 15 App Router | RSC, SSE streaming, great DX |
| Styling | Tailwind CSS | Full design control |
| Backend | FastAPI Python 3.12 | Async, ideal for SSE + AI tools |
| ORM | SQLAlchemy 2.0 async | Type-safe, works with SQLite |
| Primary DB | SQLite (`EDITH.db`) | Zero-config, single-user, portable |
| Vector DB | ChromaDB (`chroma_db/`) | Local, no separate service needed |
| Agent Framework | LangGraph | Explicit ReAct graph, streaming |
| Primary LLM | OpenRouter (gemini-2.5-flash) | Free/cheap, long context, fast |
| Fallback LLM | Ollama (qwen2.5:3b) | Offline-capable, local |
| Embeddings | nomic-embed-text (Ollama) | Free, 768-dim, strong quality |
| Auth | Google OAuth 2.0 + Spotify OAuth | Token files (no DB table) |
| Voice | Web Speech API (browser-native) | Zero dependency |
| Background | Python threading | Simple call-monitor service |

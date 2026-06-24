# EDITH — System Architecture
### v1.1 · June 2026

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        EDITH PLATFORM                            │
│                                                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                   NEXT.JS FRONTEND                      │    │
│  │  Dashboard │ Calendar │ Language │ DSA │ Research        │    │
│  │  Knowledge │ Career   │ Skills   │ AI Coach             │    │
│  └────────────────────┬───────────────────────────────────┘    │
│                        │ HTTPS / WebSocket                      │
│  ┌────────────────────▼───────────────────────────────────┐    │
│  │                  FASTAPI BACKEND                         │    │
│  │                                                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │    │
│  │  │  REST API    │  │  WebSocket   │  │  Background  │  │    │
│  │  │  Routers     │  │  Gateway     │  │  Workers     │  │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │    │
│  │         └─────────────────┼─────────────────┘          │    │
│  │                           │                              │    │
│  │  ┌────────────────────────▼──────────────────────────┐  │    │
│  │  │              AGENT ORCHESTRATION LAYER             │  │    │
│  │  │                   (LangGraph)                      │  │    │
│  │  │                                                    │  │    │
│  │  │  [Orchestrator] ──► [Calendar Agent]  (Ollama)     │  │    │
│  │  │                 ──► [Language Agent]  (Ollama)     │  │    │
│  │  │                 ──► [Research Agent]  (Claude*)    │  │    │
│  │  │                 ──► [Career Agent]    (Ollama)     │  │    │
│  │  │                 ──► [DSA Agent]       (Ollama)     │  │    │
│  │  │                 ──► [Skills Agent]    (Ollama)     │  │    │
│  │  │                 ──► [Knowledge Agent] (Ollama+emb) │  │    │
│  │  │                                                    │  │    │
│  │  │  * Claude used only when Ollama insufficient       │  │    │
│  │  └────────────────────────────────────────────────────┘  │    │
│  │                                                          │    │
│  │  ┌────────────┐  ┌──────────────┐  ┌────────────────┐  │    │
│  │  │ PostgreSQL │  │   pgvector   │  │ Supabase Store │  │    │
│  │  │ (primary)  │  │ (embeddings) │  │   (files/PDFs) │  │    │
│  │  └────────────┘  └──────────────┘  └────────────────┘  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  LOCAL AI (OLLAMA)                        │   │
│  │  llama3.2:3b (fast routing) │ llama3.1:8b (general)      │   │
│  │  nomic-embed-text (embeddings, free, 768-dim)            │   │
│  │  mistral:7b (code tasks)                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  External APIs (used sparingly):                                │
│  Google Calendar │ Microsoft Graph │ arXiv │ Semantic Scholar   │
│  LeetCode │ Claude API (complex tasks only) │ OpenAI (optional) │
└─────────────────────────────────────────────────────────────────┘
```

## Request Flow

### Simple CRUD
```
User Action → Next.js → FastAPI Router (JWT validated) → PostgreSQL → Response
```

### AI Request (Ollama, typical)
```
User Action → FastAPI → Agent Orchestration (LangGraph)
  → Orchestrator (llama3.2:3b) determines which agent
  → Specialist Agent (llama3.1:8b) with DB context
  → Streams response via WebSocket → Next.js renders tokens
  → Persists conversation to DB
```

### AI Request (Claude, complex)
```
Research summary / skill gap deep analysis / complex curriculum design
  → FastAPI checks: "does this need Claude?"
  → Yes → Claude API called with full context
  → Response cached in DB (not re-generated unless stale)
  → Streams to client
```

### Embedding Flow (Knowledge Vault)
```
Item added → nomic-embed-text (Ollama, free) → 768-dim vector → pgvector
Query → embed query → cosine similarity search → top-5 chunks → llama3.1:8b → answer
```

### Daily Briefing (Background)
```
APScheduler: 7:00 AM user-timezone
  → Collect from all modules (DB queries, no AI)
  → llama3.2:3b synthesizes structured briefing JSON
  → Stored in daily_briefings table
  → Dashboard widget shows on next load
```

## Technology Rationale by Layer

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 14 App Router | RSC, streaming, great DX |
| Styling | Tailwind + ShadCN | Production components fast |
| State | Zustand + React Query | Minimal + powerful server state |
| Auth | Clerk | OAuth, webhooks, JWT all solved |
| Backend | FastAPI Python 3.12 | Async, great for AI integration |
| ORM | SQLAlchemy 2.0 async | Type-safe, production-grade |
| Primary DB | PostgreSQL 16 | Single source of truth |
| Vector DB | pgvector (embedded in PG) | No separate vector DB needed at personal scale |
| Local AI | Ollama | Free, private, offline-capable |
| Cloud AI | Claude Sonnet 4.6 | Long context, best for paper processing |
| Embeddings | nomic-embed-text via Ollama | Free, 768-dim, strong quality |
| File storage | Supabase Storage | S3-compatible, generous free tier |
| Background | APScheduler | Simple cron, embedded in FastAPI |
| Deployment | Docker + Azure | User's preference |

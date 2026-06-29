# EDITH — Tech Stack Decisions
### v2.0 · June 2026

## UI Design System
| Element | Choice | Details |
|---|---|---|
| Color: Background | #0A3323 Dark green | Main app background |
| Color: Surface/Cards | #105666 Midnight green | Card backgrounds, sidebar |
| Color: Accent/Success | #839958 Moss green | Interactive, progress, active states |
| Color: Soft/Light | #F7F4D5 Beige | Text on dark, light panels |
| Color: CTA/Alert | #D3968C Rosy brown | Buttons, notifications, important |
| Font: Display | Cormorant Garamond | Logo, hero headings (Google Fonts) |
| Font: Headings | Playfair Display | H1, H2, section titles (Google Fonts) |
| Font: Body | DM Sans | UI text, paragraphs (Google Fonts) |
| Font: Mono | JetBrains Mono | DSA code, solutions (Google Fonts) |

## Full Stack
| Layer | Choice | Rejected | Why |
|---|---|---|---|
| Frontend | Next.js 15 App Router | Vite+React | RSC, SSE streaming, great DX |
| Styling | Tailwind CSS | MUI, Chakra | Full design control, no override fights |
| Backend | FastAPI Python 3.12 | Django, Express | Async, ideal for SSE + AI tools |
| ORM | SQLAlchemy 2.0 async | Tortoise, Prisma | Type-safe, works with SQLite, Alembic-ready |
| Primary DB | SQLite (`EDITH.db`) | PostgreSQL / SQLite| Zero-config, single-user, portable — no Docker needed for DB |
| Vector DB | ChromaDB (local, `chroma_db/`) | pgvector, Pinecone | No separate service; embedded in the API process |
| Auth | Google OAuth 2.0 + Spotify OAuth 2.0 | Clerk, Auth.js | Token files (`google_tokens.json`, `spotify_tokens.json`); simple, no extra service |
| Primary LLM | OpenRouter (`google/gemini-2.5-flash`) | GPT-4o | Cheap/free credits, long context, swappable model |
| Fallback LLM | Ollama (`qwen2.5:3b`) | None | Offline-capable, fully local, zero cost |
| Embeddings | `nomic-embed-text` via Ollama | OpenAI ada-002 | Free, 768-dim, strong quality |
| Agent Framework | LangGraph | AutoGen, CrewAI | Explicit ReAct graph, SSE streaming, production-grade |
| Voice | Web Speech API (browser-native) | Whisper, AssemblyAI | Zero dependency, zero cost |
| Background | Python `threading` | APScheduler, Celery | Simple call-monitor service; no task queue needed at this scale |
| Deployment | Local (Docker optional) | Azure, Vercel | Personal tool; no cloud hosting needed yet |

## What Was Changed from v1 Design

| v1 Plan | v2 Reality | Reason |
|---|---|---|
| PostgreSQL / SQLite + pgvector | SQLite + ChromaDB | No need for a separate DB server for a personal tool |
| Supabase Storage | Local `knowledge_base/` + ChromaDB | Simpler; files stay local |
| Clerk (auth service) | Google + Spotify OAuth token files | Avoids Clerk dependency and user tables |
| Turborepo monorepo (`apps/`) | Simple two-folder layout (`api/`, `edith/`) | No need for monorepo tooling at this scale |
| Multi-agent hierarchy (7 specialist agents) | Single ReAct agent with 80+ tools | Simpler graph, easier to extend, less latency |
| Ollama-primary, Claude fallback | OpenRouter-primary, Ollama fallback | OpenRouter gives free cloud model access |
| APScheduler workers | `services/call_monitor.py` thread | Only background need is call detection |
| Azure deployment | Local dev only (for now) | Personal tool; deploy later if needed |

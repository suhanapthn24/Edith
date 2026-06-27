# EDITH — AI Personal Operating System
### Design Document Index · v2.0 · June 2026

## What is EDITH?
A personal AI operating system that acts as a chief of staff — aware of goals, schedule, learning progress, and projects. Continuously answers: *"What should I do right now?"*

## Module List (v2.0)
| ID | Module | Status |
|---|---|---|
| M1 | AI Life Dashboard | Active |
| M2 | Calendar Intelligence | Active |
| M3 | Language Learning Hub | Active |
| M4 | Research Paper Hub | Active |
| M5 | DSA Learning System (NeetCode 150) | Active |
| M6 | Knowledge Vault | Active |
| M7 | Career Operating System | Active |
| M8 | Skill Building & Certifications | Active |
| ~~M9~~ | ~~AI Daily Briefing~~ | Dropped (merged into M1 dashboard widget) |
| ~~M10~~ | ~~AI Coach~~ | Dropped (merged into M1) |

## Design Documents
- [01 — Product Requirements Document](01-prd.md)
- [02 — Database Schema](02-database-schema.sql)
- [03 — System Architecture](03-system-architecture.md)
- [04 — Agent Architecture](04-agent-architecture.md)
- [05 — Folder Structure](05-folder-structure.md)
- [08 — MVP Roadmap](08-mvp-roadmap.md)
- [10 — Implementation Plan](10-implementation-plan.md)
- [12 — Tech Stack Decisions](12-tech-stack.md)

## Key Design Decisions (v2.0)
- **Single ReAct agent** — one APEX agent (`agent/apex.py`) with 80+ tools replaces the multi-agent hierarchy from v1
- **OpenRouter-first** — `google/gemini-2.5-flash` via OpenRouter is the primary LLM; Ollama (`qwen2.5:3b`) is the offline fallback
- **SQLite, not PostgreSQL** — zero-config, single-user DB; `EDITH.db` for all module data, `apex.db` for agent state
- **ChromaDB for RAG** — local vector store embedded in the API process; no separate service
- **No Clerk** — Google and Spotify OAuth with simple JSON token files
- **No monorepo** — `api/` and `edith/` are independent folders; no Turborepo needed
- **DSA:** NeetCode 150 roadmap as the primary curriculum
- **Hologram mode** — `hologram.html` + WebSocket endpoint for an AR overlay experience

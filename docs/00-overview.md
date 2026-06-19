# APEX — AI Personal Operating System
### Design Document Index · v1.1 · June 2026

## What is APEX?
A personal AI operating system that acts as a chief of staff — aware of goals, schedule, learning progress, and projects. Continuously answers: *"What should I do right now?"*

## Module List (v1.1)
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
| ~~M9~~ | ~~AI Daily Briefing~~ | Dropped |
| ~~M10~~ | ~~AI Coach~~ | Dropped (merged into M1) |

## Design Documents
- [01 — Product Requirements Document](01-prd.md)
- [02 — Database Schema](02-database-schema.sql)
- [03 — System Architecture](03-system-architecture.md)
- [04 — Agent Architecture (Ollama-first)](04-agent-architecture.md)
- [05 — Folder Structure](05-folder-structure.md)
- [06 — API Design](06-api-design.md)
- [07 — UI Wireframes & User Flows](07-ui-wireframes.md)
- [08 — MVP Roadmap](08-mvp-roadmap.md)
- [09 — Phase 2 & 3 Roadmap](09-phase-roadmap.md)
- [10 — Implementation Plan](10-implementation-plan.md)
- [11 — Claude Code Task Breakdown](11-task-breakdown.md)
- [12 — Tech Stack Decisions](12-tech-stack.md)

## Key Design Decisions (v1.1)
- **Agent models:** Ollama (local, free) for routine/fast tasks; Claude Sonnet 4.6 only for complex reasoning and long-context processing
- **DSA:** NeetCode 150 roadmap as the primary curriculum; problems tagged to NeetCode categories
- **No Project Management module** in v1 (too much scope; add later if needed)
- **No separate Daily Briefing module** — briefing is a widget on the dashboard

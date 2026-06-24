# EDITH — Folder Structure
### v1.1 · June 2026

```
EDITH/
├── apps/
│   ├── web/                          # Next.js 14 frontend
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   │   │   └── sign-up/[[...sign-up]]/page.tsx
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx        # Sidebar + topbar shell
│   │   │   │   ├── page.tsx          # AI Life Dashboard
│   │   │   │   ├── calendar/page.tsx
│   │   │   │   ├── language/
│   │   │   │   │   ├── page.tsx      # Language selection
│   │   │   │   │   └── [lang]/page.tsx
│   │   │   │   ├── research/page.tsx
│   │   │   │   ├── dsa/page.tsx      # NeetCode 150 tracker
│   │   │   │   ├── knowledge/page.tsx
│   │   │   │   ├── career/page.tsx
│   │   │   │   └── skills/page.tsx   # M8: Skill Building
│   │   │   ├── api/webhook/clerk/route.ts
│   │   │   ├── layout.tsx            # Root layout (fonts, providers)
│   │   │   └── globals.css           # Tailwind + CSS variables
│   │   ├── components/
│   │   │   ├── ui/                   # ShadCN primitives (auto-generated)
│   │   │   ├── layout/
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── topbar.tsx
│   │   │   │   └── breadcrumb.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── briefing-card.tsx
│   │   │   │   ├── focus-list.tsx
│   │   │   │   ├── streaks-row.tsx
│   │   │   │   ├── calendar-preview.tsx
│   │   │   │   └── quick-stats.tsx
│   │   │   ├── language/
│   │   │   ├── dsa/
│   │   │   ├── research/
│   │   │   ├── knowledge/
│   │   │   ├── career/
│   │   │   ├── skills/
│   │   │   └── ai/
│   │   │       ├── chat-panel.tsx
│   │   │       └── streaming-message.tsx
│   │   ├── hooks/
│   │   │   ├── use-ai-stream.ts
│   │   │   └── use-streaks.ts
│   │   ├── lib/
│   │   │   ├── api.ts
│   │   │   ├── websocket.ts
│   │   │   └── utils.ts
│   │   ├── store/                    # Zustand stores
│   │   ├── types/
│   │   ├── tailwind.config.ts        # Custom palette + fonts
│   │   └── next.config.ts
│   │
│   └── api/                          # FastAPI backend
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── routers/
│       │   ├── auth.py
│       │   ├── calendar.py
│       │   ├── language.py
│       │   ├── research.py
│       │   ├── dsa.py
│       │   ├── knowledge.py
│       │   ├── career.py
│       │   ├── skills.py             # M8
│       │   └── ai.py
│       ├── models/                   # SQLAlchemy ORM
│       ├── schemas/                  # Pydantic
│       ├── services/
│       │   ├── sm2_service.py        # Spaced repetition
│       │   ├── embedding_service.py  # Ollama nomic-embed-text
│       │   └── ollama_service.py     # Ollama client wrapper
│       ├── agents/
│       │   ├── orchestrator.py
│       │   ├── calendar_agent.py
│       │   ├── language_agent.py
│       │   ├── research_agent.py
│       │   ├── dsa_agent.py
│       │   ├── career_agent.py
│       │   ├── skills_agent.py
│       │   ├── knowledge_agent.py
│       │   ├── tools/
│       │   └── graph.py
│       ├── integrations/
│       │   ├── google_calendar.py
│       │   ├── microsoft_graph.py
│       │   ├── arxiv_client.py
│       │   ├── semantic_scholar.py
│       │   └── ollama_client.py
│       ├── workers/
│       │   ├── briefing_worker.py
│       │   └── calendar_sync.py
│       └── migrations/
│
├── infrastructure/
│   ├── docker-compose.yml
│   ├── Dockerfile.web
│   ├── Dockerfile.api
│   └── azure/
│
└── docs/                             # This folder
```

# APEX — Tech Stack Decisions
### v1.1 · June 2026

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
| Frontend | Next.js 14 App Router | Vite+React | RSC, streaming, great DX |
| Styling | Tailwind + ShadCN | MUI, Chakra | Full design control, no override fights |
| State | Zustand + React Query | Redux | Minimal + powerful server state |
| Auth | Clerk | Auth.js | OAuth, webhooks, JWT all solved out of box |
| Backend | FastAPI Python 3.12 | Django, Express | Async, perfect for AI agent integration |
| ORM | SQLAlchemy 2.0 async | Tortoise, Prisma | Type-safe, production-grade, Alembic migrations |
| Primary DB | PostgreSQL 16 | MySQL, MongoDB | Best SQL + pgvector in one system |
| Vector DB | pgvector (in PG) | Pinecone, Weaviate | No separate service at personal scale |
| Local AI | Ollama (llama3.1:8b, codellama, nomic-embed-text) | None | Free, private, offline |
| Cloud AI | Claude Sonnet 4.6 | GPT-4o | Better long-context for papers |
| Embeddings | nomic-embed-text via Ollama | OpenAI ada-002 | Free, 768-dim, strong quality |
| Agent Framework | LangGraph | AutoGen, CrewAI | Explicit graph control, production-grade |
| File Storage | Supabase Storage | AWS S3 | Simpler SDK, generous free tier |
| Background Jobs | APScheduler | Celery | Simpler to start; migrate later if needed |
| Deployment | Docker + Azure App Service | Vercel+Railway | User preference, unified platform |
| Monorepo | Turborepo | nx | Faster builds, simpler config |

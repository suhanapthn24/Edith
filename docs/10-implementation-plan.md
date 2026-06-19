# APEX — Implementation Plan
### v1.1 · June 2026

## Current State (as of June 19, 2026)

### ✅ Done
- Full design documentation (PRD, DB schema, system arch, agent arch, folder structure, API, roadmaps)
- Next.js 16 + Tailwind v4 + DM Sans + Playfair Display + Cormorant Garamond + JetBrains Mono
- Color palette implemented: Dark green #0A3323, Moss green #839958, Beige #F7F4D5, Rosy brown #D3968C, Midnight green #105666
- Dashboard page `/dashboard` with: AI Briefing card, Focus list, Streaks, Calendar preview, NeetCode 150 progress, Language progress, Quick stats
- Top navigation bar with logo (logo.png), all 8 module links, notifications
- FastAPI project structure: `api/` directory
- DSA service: router, models (SQLAlchemy), schemas (Pydantic), SM-2 service
- Docker Compose: PostgreSQL 16 + pgvector

### 🔧 In Progress
- Python dependency installation (core packages)
- AI packages (langchain, langgraph, ollama) — install separately after core

### ⬜ Next Steps (in order)

#### Step 1: Get backend running locally
1. Complete pip install (core packages)
2. Copy `.env.example` to `.env`, set `DATABASE_URL`
3. Start Docker: `docker-compose up -d`
4. Run API: `.venv\Scripts\uvicorn main:app --reload`
5. Test: `GET http://localhost:8000/health`
6. Test: `GET http://localhost:8000/api/v1/dsa/categories`

#### Step 2: Install AI packages (separately)
```bash
.venv\Scripts\pip install anthropic langchain langchain-anthropic langchain-community langgraph ollama supabase PyPDF2
```

#### Step 3: Seed NeetCode 150 problems
- Create `api/scripts/seed_neetcode.py`
- Seed all 150 problems with correct categories, LeetCode IDs, slugs, difficulty
- Run once: `python scripts/seed_neetcode.py`

#### Step 4: Connect frontend to backend (DSA module)
- Create `apex/src/app/(dashboard)/dsa/page.tsx`
- Create `apex/src/lib/api.ts` (axios/fetch wrapper pointing to localhost:8000)
- Replace mock data in NeetcodeProgress widget with real API call

#### Step 5: Language module
- Add language models to FastAPI
- Add language router (CRUD + SM-2)
- Build Language Hub page in Next.js

#### Step 6: Knowledge Vault + Ollama
- Install Ollama: https://ollama.ai/
- Pull models: `ollama pull nomic-embed-text llama3.1:8b llama3.2:3b codellama:7b`
- Add embedding service in FastAPI
- Build Knowledge Vault page in Next.js

## Dev Commands

### Frontend
```bash
cd apex
npm run dev          # http://localhost:3000
```

### Backend
```bash
cd api
docker-compose up -d                         # Start PostgreSQL
.venv\Scripts\uvicorn main:app --reload      # http://localhost:8000
# API docs: http://localhost:8000/docs
```

### Ollama (when ready)
```bash
ollama serve         # Start Ollama server (localhost:11434)
ollama pull llama3.2:3b
ollama pull llama3.1:8b
ollama pull codellama:7b
ollama pull nomic-embed-text
```

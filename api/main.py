from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import engine, Base
from routers import dsa, research, language


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="APEX API",
    description="AI Personal Operating System — Backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(dsa.router)
app.include_router(research.router)
app.include_router(language.router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "apex-api"}

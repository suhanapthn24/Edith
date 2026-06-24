from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import engine, Base
from routers.chat import router as chat_router
from routers.google_auth import router as google_auth_router
from routers.spotify_auth import router as spotify_auth_router
from routers.calls import router as calls_router

# Import models so SQLAlchemy registers them before create_all
import models  # noqa: F401
import services.call_monitor as call_monitor


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    call_monitor.start()
    yield
    await engine.dispose()


app = FastAPI(
    title="EDITH",
    description="Personal AI Operating System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(google_auth_router)
app.include_router(spotify_auth_router)
app.include_router(calls_router)


@app.get("/health")
async def health():
    return {"status": "ok", "model": settings.OLLAMA_MODEL}

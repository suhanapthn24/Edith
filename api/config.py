from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/apex"

    # AI
    ANTHROPIC_API_KEY: str = ""
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_DEFAULT_MODEL: str = "llama3.1:8b"
    OLLAMA_FAST_MODEL: str = "llama3.2:3b"
    OLLAMA_CODE_MODEL: str = "codellama:7b"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"

    # Auth
    CLERK_SECRET_KEY: str = ""
    CLERK_JWKS_URL: str = ""

    # Storage
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_KEY: str = ""

    # App
    APP_ENV: str = "development"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]


settings = Settings()

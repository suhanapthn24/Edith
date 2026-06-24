from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "qwen2.5:3b"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENROUTER_API_KEY: str = "REDACTED-OPENROUTER-KEY"
    OPENROUTER_MODEL: str = "google/gemini-2.5-flash"
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # Google OAuth — fill these in api/.env after Google Cloud setup
    GOOGLE_CLIENT_ID: str = "REDACTED-GOOGLE-CLIENT-ID"
    GOOGLE_CLIENT_SECRET: str = "REDACTED-GOOGLE-CLIENT-SECRET"
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/v1/auth/google/callback"
    YOUTUBE_API_KEY: str = "REDACTED-GOOGLE-API-KEY"
    GOOGLE_MAPS_API_KEY: str = "REDACTED-GOOGLE-API-KEY"
    SPOTIFY_CLIENT_ID: str = "REDACTED-SPOTIFY-CLIENT-ID"
    SPOTIFY_CLIENT_SECRET: str = "REDACTED-SPOTIFY-CLIENT-SECRET"
    SPOTIFY_REDIRECT_URI: str = "http://127.0.0.1:8000/api/v1/auth/spotify/callback"
    WEATHER_API_KEY: str = "REDACTED-WEATHER-API-KEY"
    OPENAI_KEY: str = "REDACTED-OPENAI-KEY"

settings = Settings()

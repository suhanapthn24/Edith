import json
import time
import httpx
from urllib.parse import urlencode
from fastapi import APIRouter
from fastapi.responses import RedirectResponse, HTMLResponse

from config import settings

router = APIRouter(prefix="/api/v1/auth/spotify", tags=["auth"])

TOKEN_FILE = "spotify_tokens.json"

SCOPES = " ".join([
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "streaming",
    "user-top-read",
    "playlist-read-private",
    "user-library-read",
])


@router.get("")
async def spotify_auth():
    params = {
        "client_id": settings.SPOTIFY_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": settings.SPOTIFY_REDIRECT_URI,
        "scope": SCOPES,
    }
    url = "https://accounts.spotify.com/authorize?" + urlencode(params)
    return RedirectResponse(url)


@router.get("/callback")
async def spotify_callback(code: str):
    try:
        resp = httpx.post(
            "https://accounts.spotify.com/api/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.SPOTIFY_REDIRECT_URI,
            },
            auth=(settings.SPOTIFY_CLIENT_ID, settings.SPOTIFY_CLIENT_SECRET),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        data["expires_at"] = time.time() + data.get("expires_in", 3600)

        with open(TOKEN_FILE, "w") as f:
            json.dump(data, f)

        return HTMLResponse("<h2>Spotify connected! You can close this tab.</h2>")
    except Exception as e:
        return HTMLResponse(f"<h2>Spotify auth failed: {e}</h2>", status_code=500)

import json
import os
import httpx
from urllib.parse import urlencode
from fastapi import APIRouter
from fastapi.responses import RedirectResponse, HTMLResponse

from config import settings

router = APIRouter(prefix="/api/v1/auth/google", tags=["auth"])

TOKEN_FILE = "google_tokens.json"

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/contacts",
    "https://www.googleapis.com/auth/contacts.other.readonly",
]


@router.get("")
async def google_auth():
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
    }
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return RedirectResponse(url)


@router.get("/callback")
async def google_callback(code: str):
    try:
        resp = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()

        tokens = {
            "token": data["access_token"],
            "refresh_token": data.get("refresh_token"),
            "token_uri": "https://oauth2.googleapis.com/token",
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "scopes": SCOPES,
        }
        with open(TOKEN_FILE, "w") as f:
            json.dump(tokens, f)

        return HTMLResponse("<h2>Google connected! You can close this tab.</h2>")
    except Exception as e:
        return HTMLResponse(f"<h2>Google auth failed: {e}</h2>", status_code=500)

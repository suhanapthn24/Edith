import json
import os
import time
import httpx

from langchain_core.tools import tool
from config import settings

TOKEN_FILE = "spotify_tokens.json"
SPOTIFY_API = "https://api.spotify.com/v1"
SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token"


def _not_connected() -> str:
    return "Spotify is not connected. CALL open_url(url='http://localhost:8000/api/v1/auth/spotify') NOW to open the auth page for the user."


def _load_tokens() -> dict | None:
    if not os.path.exists(TOKEN_FILE):
        return None
    with open(TOKEN_FILE) as f:
        return json.load(f)


def _save_tokens(tokens: dict):
    with open(TOKEN_FILE, "w") as f:
        json.dump(tokens, f)


def _get_access_token() -> str | None:
    tokens = _load_tokens()
    if not tokens:
        return None

    # Return existing token if not expired (with 60s buffer)
    expires_at = tokens.get("expires_at", 0)
    if time.time() < expires_at - 60:
        return tokens.get("access_token")

    if "refresh_token" not in tokens:
        return tokens.get("access_token")

    try:
        resp = httpx.post(
            SPOTIFY_TOKEN_URL,
            data={"grant_type": "refresh_token", "refresh_token": tokens["refresh_token"]},
            auth=(settings.SPOTIFY_CLIENT_ID, settings.SPOTIFY_CLIENT_SECRET),
            timeout=8,
        )
        resp.raise_for_status()
        new_tokens = resp.json()
        if "refresh_token" not in new_tokens:
            new_tokens["refresh_token"] = tokens["refresh_token"]
        new_tokens["expires_at"] = time.time() + new_tokens.get("expires_in", 3600)
        _save_tokens(new_tokens)
        return new_tokens["access_token"]
    except Exception:
        return tokens.get("access_token")


def _api(method: str, path: str, **kwargs) -> dict:
    token = _get_access_token()
    if not token:
        raise RuntimeError("not_connected")
    resp = httpx.request(
        method,
        f"{SPOTIFY_API}{path}",
        headers={"Authorization": f"Bearer {token}"},
        timeout=8,
        **kwargs,
    )
    resp.raise_for_status()
    if resp.status_code == 204 or not resp.content:
        return {}
    return resp.json()


@tool
def search_spotify(query: str, type: str = "track") -> str:
    """Search Spotify for tracks, artists, albums, or playlists.
    type can be: track, artist, album, playlist. Returns top 5 results with URIs."""
    try:
        data = _api("GET", "/search", params={"q": query, "type": type, "limit": 5})
    except RuntimeError:
        return _not_connected()
    except Exception as e:
        return f"Spotify search failed: {e}"

    key = f"{type}s"
    items = data.get(key, {}).get("items", [])
    if not items:
        return f"No Spotify results found for: {query}"

    lines = []
    for item in items:
        name = item.get("name", "Unknown")
        uri = item.get("uri", "")
        if type == "track":
            artists = ", ".join(a["name"] for a in item.get("artists", []))
            lines.append(f"• {name} by {artists}  [uri: {uri}]")
        elif type == "artist":
            lines.append(f"• {name}  [uri: {uri}]")
        elif type == "album":
            artists = ", ".join(a["name"] for a in item.get("artists", []))
            lines.append(f"• {name} by {artists}  [uri: {uri}]")
        elif type == "playlist":
            owner = item.get("owner", {}).get("display_name", "")
            lines.append(f"• {name} by {owner}  [uri: {uri}]")

    return f"Spotify {type} results:\n" + "\n".join(lines)


def _get_device_id() -> str | None:
    """Return the active device ID, or the first available device if none is active."""
    try:
        data = _api("GET", "/me/player/devices")
        devices = data.get("devices", [])
        if not devices:
            return None
        active = next((d for d in devices if d.get("is_active")), None)
        return (active or devices[0])["id"]
    except Exception:
        return None


@tool
def play_spotify(uri: str) -> str:
    """Play a Spotify track, album, or playlist by URI on the active device.
    URI format: spotify:track:xxx, spotify:album:xxx, spotify:playlist:xxx"""
    try:
        device_id = _get_device_id()
        params = {"device_id": device_id} if device_id else {}
        if uri.startswith("spotify:track:"):
            _api("PUT", "/me/player/play", params=params, json={"uris": [uri]})
        else:
            _api("PUT", "/me/player/play", params=params, json={"context_uri": uri})
        return f"Playing {uri} on Spotify."
    except RuntimeError:
        return _not_connected()
    except Exception as e:
        return f"Playback failed: {e}"


@tool
def control_playback(action: str) -> str:
    """Control Spotify playback. action must be one of: pause, stop, resume, next, previous.
    Use 'stop' or 'pause' to stop playback; 'resume' to continue."""
    try:
        match action:
            case "pause" | "stop":
                _api("PUT", "/me/player/pause")
                return "Spotify stopped." if action == "stop" else "Spotify paused."
            case "resume" | "play":
                _api("PUT", "/me/player/play")
                return "Spotify resumed."
            case "next" | "skip":
                _api("POST", "/me/player/next")
                return "Skipped to next track."
            case "previous" | "back":
                _api("POST", "/me/player/previous")
                return "Went back to previous track."
            case _:
                return f"Unknown action '{action}'. Use: stop, pause, resume, next, previous."
    except RuntimeError:
        return _not_connected()
    except Exception as e:
        return f"Playback control failed: {e}"


@tool
def get_current_track() -> str:
    """Get the currently playing Spotify track."""
    try:
        data = _api("GET", "/me/player/currently-playing")
        if not data or not data.get("item"):
            return "Nothing is currently playing on Spotify."
        item = data["item"]
        name = item["name"]
        artists = ", ".join(a["name"] for a in item.get("artists", []))
        is_playing = data.get("is_playing", False)
        status = "Playing" if is_playing else "Paused"
        return f"{status}: {name} by {artists}"
    except RuntimeError:
        return _not_connected()
    except Exception as e:
        return f"Could not get current track: {e}"


@tool
def get_top_tracks() -> str:
    """Get the user's top 5 Spotify tracks of all time."""
    try:
        data = _api("GET", "/me/top/tracks", params={"time_range": "long_term", "limit": 5})
        items = data.get("items", [])
        if not items:
            return "No top tracks found."
        lines = [
            f"{i+1}. {t['name']} by {', '.join(a['name'] for a in t['artists'])}"
            for i, t in enumerate(items)
        ]
        return "Your top Spotify tracks:\n" + "\n".join(lines)
    except RuntimeError:
        return _not_connected()
    except Exception as e:
        return f"Could not get top tracks: {e}"


@tool
def add_to_queue(uri: str) -> str:
    """Add a Spotify track to the playback queue by URI (spotify:track:xxx)."""
    try:
        _api("POST", "/me/player/queue", params={"uri": uri})
        return f"Added {uri} to your Spotify queue."
    except RuntimeError:
        return _not_connected()
    except Exception as e:
        return f"Could not add to queue: {e}"

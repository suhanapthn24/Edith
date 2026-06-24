import httpx
from langchain_core.tools import tool
from config import settings


@tool
def open_url(url: str) -> str:
    """Open any URL in the user's browser. Provide the complete URL including https://."""
    return f"Opened: {url}"


@tool
def search_youtube(query: str) -> str:
    """Search YouTube for videos and return top results with titles and URLs.
    Use this when the user asks to find, watch, or play a video."""
    if not settings.YOUTUBE_API_KEY:
        return f"Searching YouTube for: {query}"

    try:
        resp = httpx.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "part": "snippet",
                "q": query,
                "maxResults": 5,
                "type": "video",
                "key": settings.YOUTUBE_API_KEY,
            },
            timeout=8,
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
        if not items:
            return f"No YouTube results found for: {query}"

        results = []
        for item in items:
            vid_id = item["id"]["videoId"]
            title = item["snippet"]["title"]
            channel = item["snippet"]["channelTitle"]
            results.append(f"• {title} — {channel}\n  https://www.youtube.com/watch?v={vid_id}")
        return "YouTube results:\n" + "\n".join(results)
    except Exception as e:
        return f"YouTube search failed: {e}. Searching YouTube for: {query}"


@tool
def search_web(query: str) -> str:
    """Search Google for information and open results in the user's browser."""
    return f"Searching web for: {query}"


@tool
def search_maps(query: str) -> str:
    """Search Google Maps for a place, address, restaurant, or business.
    Opens the map in the user's browser."""
    return f"Opening Google Maps for: {query}"


@tool
def get_directions(origin: str, destination: str) -> str:
    """Get distance and travel time between two places. Returns distance and duration as text.
    Use this when the user asks how far, how long, or for directions."""
    try:
        resp = httpx.get(
            "https://maps.googleapis.com/maps/api/distancematrix/json",
            params={
                "origins": origin,
                "destinations": destination,
                "key": settings.GOOGLE_MAPS_API_KEY,
            },
            timeout=8,
        )
        data = resp.json()
        row = data.get("rows", [{}])[0].get("elements", [{}])[0]
        status = row.get("status", "")
        if status == "OK":
            distance = row["distance"]["text"]
            duration = row["duration"]["text"]
            return f"{origin} → {destination}: {distance}, about {duration} by car."
        else:
            return f"Could not get directions ({status})."
    except Exception as e:
        return f"Directions lookup failed: {e}"

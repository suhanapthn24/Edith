import json
import os
from datetime import datetime, timedelta

from langchain_core.tools import tool
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

TOKEN_FILE = "google_tokens.json"  # relative to api/ working directory


def _get_creds() -> Credentials | None:
    if not os.path.exists(TOKEN_FILE):
        return None
    with open(TOKEN_FILE) as f:
        data = json.load(f)
    creds = Credentials(
        token=data.get("token"),
        refresh_token=data.get("refresh_token"),
        token_uri=data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=data.get("client_id"),
        client_secret=data.get("client_secret"),
        scopes=data.get("scopes"),
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        data["token"] = creds.token
        with open(TOKEN_FILE, "w") as f:
            json.dump(data, f)
    return creds


def _not_connected() -> str:
    return "Google Calendar not connected. Tell the user to visit http://localhost:8000/api/v1/auth/google to connect."


@tool
def list_calendar_events(date_filter: str = "") -> str:
    """List events from Google Calendar. date_filter is 'YYYY-MM-DD' for a specific day, or empty for the next 7 days."""
    creds = _get_creds()
    if not creds:
        return _not_connected()

    service = build("calendar", "v3", credentials=creds)
    now = datetime.utcnow()

    if date_filter:
        try:
            day = datetime.strptime(date_filter, "%Y-%m-%d")
            time_min = day.isoformat() + "Z"
            time_max = (day + timedelta(days=1)).isoformat() + "Z"
        except ValueError:
            time_min = now.isoformat() + "Z"
            time_max = (now + timedelta(days=7)).isoformat() + "Z"
    else:
        time_min = now.isoformat() + "Z"
        time_max = (now + timedelta(days=7)).isoformat() + "Z"

    result = (
        service.events()
        .list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            maxResults=20,
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )

    events = result.get("items", [])
    if not events:
        return "No events found."

    lines = []
    for e in events:
        start = e["start"].get("dateTime", e["start"].get("date", ""))
        title = e.get("summary", "(no title)")
        event_id = e.get("id", "")
        try:
            dt = datetime.fromisoformat(start.replace("Z", "+00:00"))
            start_fmt = dt.strftime("%a %b %d, %I:%M %p")
        except Exception:
            start_fmt = start
        lines.append(f"• {start_fmt} — {title} [id:{event_id}]")

    return "\n".join(lines)


@tool
def create_calendar_event(title: str, start: str, end: str, description: str = "") -> str:
    """Create an event in Google Calendar. start and end must be ISO: YYYY-MM-DDTHH:MM:00"""
    creds = _get_creds()
    if not creds:
        return _not_connected()

    service = build("calendar", "v3", credentials=creds)
    body = {
        "summary": title,
        "description": description,
        "start": {"dateTime": start, "timeZone": "UTC"},
        "end": {"dateTime": end, "timeZone": "UTC"},
    }
    event = service.events().insert(calendarId="primary", body=body).execute()
    return f"Created '{title}' on {start} (id: {event.get('id', '')[:12]})"


@tool
def delete_calendar_event(event_id: str) -> str:
    """Delete a Google Calendar event by its full event ID (from list_calendar_events)."""
    creds = _get_creds()
    if not creds:
        return _not_connected()

    service = build("calendar", "v3", credentials=creds)
    try:
        service.events().delete(calendarId="primary", eventId=event_id).execute()
        return f"Deleted event {event_id[:12]}."
    except Exception as e:
        return f"Could not delete event: {e}"

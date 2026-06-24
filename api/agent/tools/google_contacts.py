import json
import os

from langchain_core.tools import tool
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

TOKEN_FILE = "google_tokens.json"


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
        data.update({"token": creds.token})
        with open(TOKEN_FILE, "w") as f:
            json.dump(data, f)
    return creds


def _not_connected() -> str:
    return "Google is not connected. CALL open_url(url='http://localhost:8000/api/v1/auth/google') NOW to open the auth page."


@tool
def search_contacts(query: str) -> str:
    """Search Google Contacts by name, email, or phone number.
    Returns matching contacts with their phone numbers and email addresses."""
    creds = _get_creds()
    if not creds:
        return _not_connected()
    try:
        service = build("people", "v1", credentials=creds)
        result = service.people().searchContacts(
            query=query,
            readMask="names,emailAddresses,phoneNumbers",
            pageSize=10,
        ).execute()

        results = result.get("results", [])
        if not results:
            return f"No contacts found matching '{query}'."

        lines = []
        for r in results:
            person = r.get("person", {})
            names = person.get("names", [])
            emails = person.get("emailAddresses", [])
            phones = person.get("phoneNumbers", [])

            name = names[0].get("displayName", "Unknown") if names else "Unknown"
            email_list = [e.get("value", "") for e in emails]
            phone_list = [p.get("value", "") for p in phones]

            parts = [f"**{name}**"]
            if phone_list:
                parts.append(f"Phone: {', '.join(phone_list)}")
            if email_list:
                parts.append(f"Email: {', '.join(email_list)}")
            lines.append(" | ".join(parts))

        return "Contacts found:\n" + "\n".join(f"• {l}" for l in lines)
    except Exception as e:
        return f"Failed to search contacts: {e}"


@tool
def call_contact(name: str) -> str:
    """Call a contact by looking up their phone number from Google Contacts and initiating a call.
    Opens the phone dialer (via tel: link) in the user's browser."""
    creds = _get_creds()
    if not creds:
        return _not_connected()
    try:
        service = build("people", "v1", credentials=creds)
        result = service.people().searchContacts(
            query=name,
            readMask="names,phoneNumbers",
            pageSize=5,
        ).execute()

        results = result.get("results", [])
        if not results:
            return f"No contact found for '{name}'."

        person = results[0].get("person", {})
        phones = person.get("phoneNumbers", [])
        names = person.get("names", [])
        display_name = names[0].get("displayName", name) if names else name

        if not phones:
            return f"{display_name} has no phone number in your contacts."

        raw = phones[0].get("value", "")
        number = "".join(c for c in raw if c.isdigit() or c == "+")
        return f"Calling {display_name}: {number}"
    except Exception as e:
        return f"Failed to look up contact: {e}"


@tool
def message_contact(name: str, message: str = "") -> str:
    """Send an SMS or open a message to a contact by looking up their phone number.
    Opens the messaging app via sms: link."""
    creds = _get_creds()
    if not creds:
        return _not_connected()
    try:
        service = build("people", "v1", credentials=creds)
        result = service.people().searchContacts(
            query=name,
            readMask="names,phoneNumbers",
            pageSize=5,
        ).execute()

        results = result.get("results", [])
        if not results:
            return f"No contact found for '{name}'."

        person = results[0].get("person", {})
        phones = person.get("phoneNumbers", [])
        names = person.get("names", [])
        display_name = names[0].get("displayName", name) if names else name

        if not phones:
            return f"{display_name} has no phone number in your contacts."

        raw = phones[0].get("value", "")
        number = "".join(c for c in raw if c.isdigit() or c == "+")
        return f"Messaging {display_name} at {number}: {message}"
    except Exception as e:
        return f"Failed to look up contact: {e}"

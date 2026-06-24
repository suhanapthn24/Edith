import base64
import json
import os
from email.mime.text import MIMEText

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
        data["token"] = creds.token
        with open(TOKEN_FILE, "w") as f:
            json.dump(data, f)
    return creds


def _not_connected() -> str:
    return "Gmail not connected. Tell the user to visit http://localhost:8000/api/v1/auth/google to connect."


@tool
def list_emails(query: str = "is:unread", max_results: int = 5) -> str:
    """List emails from Gmail. query uses Gmail search syntax: 'is:unread', 'from:boss@company.com', 'subject:meeting', etc."""
    creds = _get_creds()
    if not creds:
        return _not_connected()

    service = build("gmail", "v1", credentials=creds)
    result = (
        service.users()
        .messages()
        .list(userId="me", q=query, maxResults=max_results)
        .execute()
    )

    messages = result.get("messages", [])
    if not messages:
        return "No emails found."

    lines = []
    for msg in messages:
        detail = (
            service.users()
            .messages()
            .get(
                userId="me",
                id=msg["id"],
                format="metadata",
                metadataHeaders=["Subject", "From", "Date"],
            )
            .execute()
        )
        headers = {h["name"]: h["value"] for h in detail["payload"]["headers"]}
        subject = headers.get("Subject", "(no subject)")
        sender = headers.get("From", "unknown")
        snippet = detail.get("snippet", "")[:120]
        lines.append(f"• [{msg['id']}]\n  From: {sender}\n  Subject: {subject}\n  {snippet}")

    return "\n\n".join(lines)


@tool
def get_email(message_id: str) -> str:
    """Get the full content of an email by its message ID.
    IMPORTANT: message_id must be the exact alphanumeric ID returned by list_emails (e.g. '18f3a2c4b1e9d7f0'), NOT a description like 'third email' or 'first-email-id'.
    Always call list_emails first to get real IDs, then pass one of those IDs here."""
    creds = _get_creds()
    if not creds:
        return _not_connected()

    if not message_id or not message_id.replace("-", "").replace("_", "").isalnum() or len(message_id) < 10:
        return "Invalid message_id. Call list_emails first to get real message IDs, then pass one of those exact IDs."

    service = build("gmail", "v1", credentials=creds)
    try:
        msg = service.users().messages().get(userId="me", id=message_id, format="full").execute()
    except Exception as e:
        return f"Could not fetch email. Make sure message_id is an exact ID from list_emails, not a description. Error: {e}"

    headers = {h["name"]: h["value"] for h in msg["payload"]["headers"]}
    subject = headers.get("Subject", "(no subject)")
    sender = headers.get("From", "unknown")
    date = headers.get("Date", "")

    body = ""
    payload = msg["payload"]
    if "parts" in payload:
        for part in payload["parts"]:
            if part.get("mimeType") == "text/plain":
                data = part["body"].get("data", "")
                body = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
                break
    elif payload.get("mimeType") == "text/plain":
        data = payload["body"].get("data", "")
        body = base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")

    return f"From: {sender}\nDate: {date}\nSubject: {subject}\n\n{body[:2000]}"


@tool
def send_email(to: str, subject: str, body: str) -> str:
    """Send an email via Gmail. to is the recipient email address."""
    creds = _get_creds()
    if not creds:
        return _not_connected()

    service = build("gmail", "v1", credentials=creds)
    mime_msg = MIMEText(body)
    mime_msg["to"] = to
    mime_msg["subject"] = subject

    raw = base64.urlsafe_b64encode(mime_msg.as_bytes()).decode()
    service.users().messages().send(userId="me", body={"raw": raw}).execute()
    return f"Email sent to {to} — Subject: {subject}"

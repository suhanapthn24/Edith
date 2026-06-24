from typing import Annotated
from typing_extensions import TypedDict
from datetime import datetime

from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langchain_ollama import ChatOllama
from langchain_openai import ChatOpenAI
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from config import settings
from agent.tools.tasks import create_task, list_tasks, complete_task, update_task, delete_task
from agent.tools.reminders import create_reminder, list_reminders, complete_reminder
from agent.tools.google_calendar import list_calendar_events, create_calendar_event, delete_calendar_event
from agent.tools.gmail import list_emails, get_email, send_email
from agent.tools.rag import search_knowledge, add_note
from agent.tools.browser import open_url, search_youtube, search_web, search_maps, get_directions, reverse_geocode
from agent.tools.spotify import search_spotify, play_spotify, control_playback, get_current_track, get_top_tracks, add_to_queue
from agent.tools.google_contacts import search_contacts, call_contact, message_contact
from agent.tools.weather import get_weather, get_forecast
from agent.tools.calls import answer_call, decline_call
from agent.tools.system_nav import (
    open_app, close_app, list_running_apps,
    open_file_or_folder, find_files, download_file,
    set_volume, get_system_info, lock_screen, take_screenshot,
)


class EDITHState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


TOOLS = [
    # Tasks (local SQLite)
    create_task, list_tasks, complete_task, update_task, delete_task,
    # Reminders (local SQLite)
    create_reminder, list_reminders, complete_reminder,
    # Google Calendar
    list_calendar_events, create_calendar_event, delete_calendar_event,
    # Gmail
    list_emails, get_email, send_email,
    # Knowledge base
    search_knowledge, add_note,
    # Browser actions (frontend opens the URL/tab)
    open_url, search_youtube, search_web, search_maps, get_directions, reverse_geocode,
    # Spotify
    search_spotify, play_spotify, control_playback, get_current_track, get_top_tracks, add_to_queue,
    # Google Contacts & communication
    search_contacts, call_contact, message_contact,
    # Weather
    get_weather, get_forecast,
    # Calls
    answer_call, decline_call,
    # System navigation (Windows)
    open_app, close_app, list_running_apps,
    open_file_or_folder, find_files, download_file,
    set_volume, get_system_info, lock_screen, take_screenshot,
]

if settings.OPENROUTER_API_KEY:
    llm = ChatOpenAI(
        model=settings.OPENROUTER_MODEL,
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
        temperature=0.3,
        max_tokens=1024,
    )
else:
    llm = ChatOllama(
        model=settings.OLLAMA_MODEL,
        base_url=settings.OLLAMA_BASE_URL,
        temperature=0.3,
        num_ctx=2048,
        num_predict=300,
        num_batch=512,
        num_thread=14,
        keep_alive=-1,
    )
llm_with_tools = llm.bind_tools(TOOLS)

SYSTEM = """\
You are EDITH, a personal AI assistant. Be direct and act immediately.
Today: {dt}
{location_ctx}
Tools available: tasks, reminders, Google Calendar, Gmail, knowledge base, browser (YouTube/web/maps), Spotify, Google Contacts, weather, system (open/close apps, files, volume, screenshot, lock, download).

Rules:
1. Call tools immediately — never ask for confirmation unless truly ambiguous.
2. After tool calls, reply in one short sentence.
3. Dates → ISO: date={today}, datetime={today}T09:00:00.
4. Weather: ALWAYS call get_weather/get_forecast. No city given → use location coords above.
5. Gmail: call list_emails first to get real IDs, then get_email with exact ID. Never guess IDs.
6. Spotify: "play X" → search_spotify+play_spotify. Controls → control_playback. Not connected → call open_url('http://localhost:8000/api/v1/auth/spotify') immediately.
7. Google not connected → visit http://localhost:8000/api/v1/auth/google.
8. Maps: place/restaurant/"where is X"/"show on map"/"open maps"/"navigate" → search_maps. "how far"/"distance"/"how long to get to" → get_directions(origin="<use coords above if user says my place/here>", destination="...") — this returns distance+time as text, do NOT also open maps.
9. "call [name]" → IMMEDIATELY call call_contact(name="[name]"). "text/message [name]" → IMMEDIATELY call message_contact(name="[name]"). A name alone is enough — never ask for more details.
10. System: "open X" / "launch X" → open_app(X). "close/kill X" → close_app(X). "what's running" → list_running_apps. "open my documents/downloads/desktop" → open_file_or_folder. "find file X" / "most recent X" → find_files(X) — results are always sorted newest first. "volume X%" → set_volume(X). "system info" → get_system_info. "lock" → lock_screen. "screenshot" → take_screenshot. "download X from URL" → download_file(url, filename).
11. Context: "it", "that", "this", "the last one", "the first one" always refer to the most recent item mentioned in the conversation. Never ask the user to clarify what they mean by these pronouns — infer from context.
12. Location: "where am I" / "what city" / "my location" → reverse_geocode(coords from above). Never answer a location question with weather.
13. Calls: "answer" / "pick up" / "answer it" → answer_call(). "decline" / "reject" / "ignore the call" → decline_call(). If there is an incoming call notification, ask "Incoming call from [caller] — answer or decline?" and wait for their response.\
"""


async def agent_node(state: EDITHState, config: RunnableConfig) -> dict:
    now = datetime.now()
    location = config.get("configurable", {}).get("location", "")
    location_ctx = (
        f"User location coords: {location}\n"
        f"- 'where am I' / 'what city' / 'my location' → reverse_geocode('{location}')\n"
        f"- Weather with no city → get_weather('{location}')\n"
        f"- 'from my place' / 'from here' / 'near me' → use '{location}' as the origin or query\n\n"
        if location else ""
    )
    system = SystemMessage(
        content=SYSTEM.format(
            dt=now.strftime("%A, %B %d %Y %H:%M"),
            today=now.strftime("%Y-%m-%d"),
            location_ctx=location_ctx,
        )
    )
    response = await llm_with_tools.ainvoke([system] + state["messages"])
    return {"messages": [response]}


def should_continue(state: EDITHState) -> str:
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return END


_tool_node = ToolNode(TOOLS)

builder = StateGraph(EDITHState)
builder.add_node("agent", agent_node)
builder.add_node("tools", _tool_node)
builder.set_entry_point("agent")
builder.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
builder.add_edge("tools", "agent")

graph = builder.compile()

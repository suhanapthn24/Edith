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
    get_clipboard, set_clipboard, power_control, set_brightness,
    create_file, delete_file, run_command, notify,
)
from agent.tools.window_manager import (
    list_windows, focus_window, minimize_window, maximize_window,
    get_active_window, click_at, type_text, send_hotkey, move_resize_window,
)
from agent.tools.advanced_control import (
    start_screen_recording, stop_screen_recording,
    list_wifi_networks, get_wifi_status, connect_wifi, disconnect_wifi, toggle_wifi,
    print_file, list_printers,
)
from agent.tools.ai_vision import (
    ask_about_screen, read_screen_text, find_text_on_screen,
    screenshot_region_text, analyze_screenshot_file,
)
from agent.tools.system_extras import (
    get_battery_status, mute_microphone, unmute_microphone, get_microphone_status,
    set_power_plan, get_power_plan,
    kill_process, get_process_details, list_top_processes,
    list_audio_devices, get_volume,
)
from agent.tools.productivity import (
    get_clipboard_history, paste_from_history,
    add_snippet, expand_snippet, list_snippets,
    start_pomodoro, stop_pomodoro, get_pomodoro_stats,
    focus_mode, exit_focus_mode,
    save_window_layout, restore_window_layout, list_window_layouts,
    daily_briefing, daily_summary,
)
from agent.tools.smart_home import (
    get_home_devices, get_home_state, control_device,
    set_light_brightness, set_thermostat, run_home_automation,
)
from agent.tools.dev_tools import (
    docker_list, docker_start, docker_stop, docker_restart, docker_logs,
    docker_images, docker_compose,
    list_open_ports, check_port, ping_host,
    git_status, git_log, git_diff, git_pull, git_commit, git_branches,
    http_get, http_post, get_env_info,
)
from agent.tools.adb_control import (
    adb_devices, adb_connect, adb_pair,
    adb_home, adb_back, adb_recent_apps, adb_power_button, adb_unlock,
    adb_tap, adb_swipe, adb_type, adb_keyevent,
    adb_screenshot, adb_list_apps, adb_open_app, adb_close_app,
    adb_send_sms, adb_phone_info, adb_push_file, adb_pull_file, adb_set_volume,
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
    # Clipboard
    get_clipboard, set_clipboard,
    # Power & display
    power_control, set_brightness,
    # File operations
    create_file, delete_file,
    # Shell & automation
    run_command, notify,
    # Window management & mouse/keyboard
    list_windows, focus_window, minimize_window, maximize_window,
    get_active_window, click_at, type_text, send_hotkey, move_resize_window,
    # Screen recording
    start_screen_recording, stop_screen_recording,
    # WiFi
    list_wifi_networks, get_wifi_status, connect_wifi, disconnect_wifi, toggle_wifi,
    # Printing
    print_file, list_printers,
    # AI Vision & OCR
    ask_about_screen, read_screen_text, find_text_on_screen,
    screenshot_region_text, analyze_screenshot_file,
    # System extras
    get_battery_status, mute_microphone, unmute_microphone, get_microphone_status,
    set_power_plan, get_power_plan,
    kill_process, get_process_details, list_top_processes,
    list_audio_devices, get_volume,
    # Productivity
    get_clipboard_history, paste_from_history,
    add_snippet, expand_snippet, list_snippets,
    start_pomodoro, stop_pomodoro, get_pomodoro_stats,
    focus_mode, exit_focus_mode,
    save_window_layout, restore_window_layout, list_window_layouts,
    daily_briefing, daily_summary,
    # Smart home (Home Assistant)
    get_home_devices, get_home_state, control_device,
    set_light_brightness, set_thermostat, run_home_automation,
    # Dev tools
    docker_list, docker_start, docker_stop, docker_restart, docker_logs,
    docker_images, docker_compose,
    list_open_ports, check_port, ping_host,
    git_status, git_log, git_diff, git_pull, git_commit, git_branches,
    http_get, http_post, get_env_info,
    # ADB (Android phone)
    adb_devices, adb_connect, adb_pair,
    adb_home, adb_back, adb_recent_apps, adb_power_button, adb_unlock,
    adb_tap, adb_swipe, adb_type, adb_keyevent,
    adb_screenshot, adb_list_apps, adb_open_app, adb_close_app,
    adb_send_sms, adb_phone_info, adb_push_file, adb_pull_file, adb_set_volume,
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
Tools available: tasks, reminders, Google Calendar, Gmail, RAG knowledge base, browser (YouTube/web/maps/directions), Spotify, Google Contacts, weather, full system control (apps, windows, files, clipboard, screenshot, recording, volume, brightness, power), AI vision (screen analysis, OCR), productivity (pomodoro, snippets, layouts, briefing), dev tools (docker, git, ports, http), Android phone control (ADB), WiFi, printing, processes, battery, microphone.

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
10. System: "open X" / "launch X" → open_app(X). "close/kill X" → close_app(X). "what's running" → list_running_apps. "open my documents/downloads/desktop" → open_file_or_folder. "find file X" / "most recent X" → find_files(X) — results are always sorted newest first. "volume X%" → set_volume(X). "brightness X%" → set_brightness(X). "system info" → get_system_info. "lock" → lock_screen. "screenshot" → take_screenshot. "download X from URL" → download_file(url, filename). "shutdown"/"restart"/"sleep"/"hibernate" → power_control(action). "cancel shutdown" → power_control('cancel').
11. Clipboard: "copy X to clipboard" / "set clipboard to X" → set_clipboard(X). "what's in my clipboard" / "what did I copy" → get_clipboard().
12. Files: "create a file named X" / "make a note called X" → create_file(path, content). "delete file X" → delete_file(path). "run X command" / "run script X" → run_command(command).
13. Windows: "focus/bring up X" → focus_window(X). "minimize X" → minimize_window(X). "maximize X" → maximize_window(X). "what window is open/active" → get_active_window(). "list open windows" → list_windows(). "move/resize X to ..." → move_resize_window. "click at X,Y" → click_at(x,y). "type X" → type_text(X) (make sure window is focused first). "press ctrl+X / send shortcut" → send_hotkey(keys).
14. Notifications: "notify me / show alert X" → notify(title, message). This sends a Windows toast notification.
15. Screen recording: "record my screen" → start_screen_recording(). "stop recording" → stop_screen_recording(). Videos save to Desktop as MP4.
16. WiFi: "wifi status" / "what wifi am I on" → get_wifi_status(). "list wifi" → list_wifi_networks(). "connect to X" → connect_wifi(ssid, password). "disconnect wifi" → disconnect_wifi(). "turn wifi on/off" → toggle_wifi(state).
17. Printing: "print X" → print_file(path). "list printers" → list_printers(). Path can be absolute or filename on Desktop.
18. Context: "it", "that", "this", "the last one", "the first one" always refer to the most recent item mentioned in the conversation. Never ask the user to clarify what they mean by these pronouns — infer from context.
19. Location: "where am I" / "what city" / "my location" → reverse_geocode(coords from above). Never answer a location question with weather.
20. Calls: "answer" / "pick up" / "answer it" → answer_call(). "decline" / "reject" / "ignore the call" → decline_call(). If there is an incoming call notification, ask "Incoming call from [caller] — answer or decline?" and wait for their response.
21. Vision: "what's on screen" / "read screen" / "describe screen" → ask_about_screen(). "extract/copy text from screen" → read_screen_text(). "where is X on screen" → find_text_on_screen(X). "analyze image X" → analyze_screenshot_file(path).
22. Battery/Mic: "battery level" → get_battery_status(). "mute/unmute mic" → mute_microphone()/unmute_microphone(). "mic status" → get_microphone_status(). "power plan X" → set_power_plan(plan). "kill process X" → kill_process(X). "top processes" → list_top_processes(). "volume level" → get_volume().
23. Productivity: "clipboard history" → get_clipboard_history(). "paste #N from history" → paste_from_history(N). "add snippet X = Y" → add_snippet(X,Y). "type my X / expand X" → expand_snippet(X). "start pomodoro" → start_pomodoro(). "stop pomodoro" → stop_pomodoro(). "save layout X" → save_window_layout(X). "restore layout X" → restore_window_layout(X). "morning briefing" → daily_briefing().
24. Dev: "docker ps/start/stop/logs X" → docker_* tools. "open ports" → list_open_ports(). "check port N" → check_port(N). "ping X" → ping_host(X). "git status/log/diff/pull/commit" → git_* tools. "GET/POST URL" → http_get/http_post. "env info" → get_env_info().
25. Android/ADB: "phone screenshot" → adb_screenshot(). "tap phone at X,Y" → adb_tap(X,Y). "type on phone X" → adb_type(X). "open app X on phone" → adb_open_app(package). "list phone apps" → adb_list_apps(). "send SMS to X: Y" → adb_send_sms(number,msg). "phone info" → adb_phone_info(). "push/pull file" → adb_push_file/adb_pull_file. "connect phone" → adb_connect(ip:port).
26. Focus mode: "focus mode" / "start focus" / "do not disturb" → focus_mode(). "exit focus" / "end focus" / "stop focus" → exit_focus_mode(). Focus mode starts Pomodoro AND suppresses email alerts automatically.
27. Pomodoro stats: "how much did I focus" / "pomodoro history" / "focus stats" → get_pomodoro_stats(). Add days=N to change look-back window.
28. Daily summary: "end of day" / "what did I do today" / "daily summary" → daily_summary(). This gives focus time + prompts to retrieve task/email data.
29. Smart home: "turn on/off/toggle [device]" → control_device(entity_id, action). "list home devices" → get_home_devices(). "set thermostat to X" → set_thermostat(entity_id, X). "set light to X%" → set_light_brightness(entity_id, X). "run automation X" → run_home_automation(automation_id). "status of [device]" → get_home_state(entity_id). Requires HA_URL + HA_TOKEN in .env.\
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

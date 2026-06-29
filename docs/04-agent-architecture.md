# EDITH — Agent Architecture
### v2.0 · June 2026

## Design: Single ReAct Agent + Tools

EDITH uses a **single LangGraph ReAct agent** (`agent/apex.py`) rather than a multi-agent hierarchy. All capabilities are exposed as tools; the LLM decides which tools to call and in what order.

```
User message
     │
     ▼
┌──────────────────────────────────────────────┐
│             EDITH agent  (ReAct loop)          │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │   LLM  (OpenRouter or Ollama)          │  │
│  │   Decides: tool call or final answer   │  │
│  └──────────────┬─────────────────────────┘  │
│                 │ tool_calls                  │
│  ┌──────────────▼─────────────────────────┐  │
│  │   ToolNode  (LangGraph prebuilt)       │  │
│  │   Executes tool → returns result       │  │
│  └──────────────┬─────────────────────────┘  │
│                 │ tool result → back to LLM   │
│  (loop until no more tool calls)              │
└──────────────────────────────────────────────┘
     │
     ▼
  SSE stream → ChatWindow.tsx
```

## LLM Selection

```python
if settings.OPENROUTER_API_KEY:
    llm = ChatOpenAI(
        model=settings.OPENROUTER_MODEL,       # "google/gemini-2.5-flash"
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.OPENROUTER_API_KEY,
    )
else:
    llm = ChatOllama(
        model=settings.OLLAMA_MODEL,           # "qwen2.5:3b"
        base_url=settings.OLLAMA_BASE_URL,     # http://localhost:11434
    )
```

| Condition | Model | Notes |
|---|---|---|
| OpenRouter key present | `google/gemini-2.5-flash` | Default; fast, long context |
| No key (offline / free) | `qwen2.5:3b` via Ollama | Fully local |
| Override via env | any OpenRouter model | e.g. `llama-3.3-70b-instruct:free` |

---

## State

```python
class EDITHState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
```

Conversation history accumulates in `messages`. No per-module context — the system prompt covers all domains.

---

## LangGraph Graph

```python
builder = StateGraph(EDITHState)
builder.add_node("agent", agent_node)     # LLM call
builder.add_node("tools", ToolNode(TOOLS))
builder.set_entry_point("agent")
builder.add_conditional_edges(
    "agent", should_continue,
    {"tools": "tools", END: END}
)
builder.add_edge("tools", "agent")        # result feeds back to LLM
graph = builder.compile()
```

---

## Tool Categories (80+ tools)

### Personal Data (SQLite)
| Tool | Description |
|---|---|
| `create_task` / `list_tasks` / `complete_task` / `update_task` / `delete_task` | Task management |
| `create_reminder` / `list_reminders` / `complete_reminder` | Reminder management |

### Google Integrations
| Tool | Description |
|---|---|
| `list_calendar_events` / `create_calendar_event` / `delete_calendar_event` | Google Calendar |
| `list_emails` / `get_email` / `send_email` | Gmail |
| `search_contacts` / `call_contact` / `message_contact` | Google Contacts |

### Media & Entertainment
| Tool | Description |
|---|---|
| `search_spotify` / `play_spotify` / `control_playback` | Spotify |
| `get_current_track` / `get_top_tracks` / `add_to_queue` | Spotify (cont.) |

### Web & Browser
| Tool | Description |
|---|---|
| `open_url` / `search_web` / `search_youtube` | Browser control |
| `search_maps` / `get_directions` / `reverse_geocode` | Maps & location |

### Weather
| Tool | Description |
|---|---|
| `get_weather` / `get_forecast` | OpenWeatherMap API |

### Knowledge Base (RAG)
| Tool | Description |
|---|---|
| `search_knowledge` | ChromaDB semantic search → answer |
| `add_note` | Embed and store a new note |

### System Control (Windows)
| Tool | Description |
|---|---|
| `open_app` / `close_app` / `list_running_apps` | App management |
| `open_file_or_folder` / `find_files` / `download_file` | File system |
| `create_file` / `delete_file` / `run_command` | File + shell |
| `set_volume` / `get_volume` / `set_brightness` | Audio + display |
| `get_system_info` / `lock_screen` / `take_screenshot` | System state |
| `get_clipboard` / `set_clipboard` / `power_control` | Clipboard + power |
| `notify` | Windows toast notification |

### Window Manager & Automation
| Tool | Description |
|---|---|
| `list_windows` / `focus_window` / `minimize_window` / `maximize_window` | Window control |
| `get_active_window` / `move_resize_window` | Window state |
| `click_at` / `type_text` / `send_hotkey` | Mouse + keyboard |

### AI Vision & OCR
| Tool | Description |
|---|---|
| `ask_about_screen` | Screenshot + LLM visual analysis |
| `read_screen_text` / `find_text_on_screen` | OCR extraction |
| `screenshot_region_text` / `analyze_screenshot_file` | Region / file analysis |

### System Extras
| Tool | Description |
|---|---|
| `get_battery_status` | Battery info |
| `mute_microphone` / `unmute_microphone` / `get_microphone_status` | Mic control |
| `set_power_plan` / `get_power_plan` | Windows power plan |
| `kill_process` / `get_process_details` / `list_top_processes` | Process management |
| `list_audio_devices` | Audio device enumeration |

### Productivity
| Tool | Description |
|---|---|
| `get_clipboard_history` / `paste_from_history` | Clipboard history |
| `add_snippet` / `expand_snippet` / `list_snippets` | Text snippets |
| `start_pomodoro` / `stop_pomodoro` | Pomodoro timer |
| `save_window_layout` / `restore_window_layout` / `list_window_layouts` | Layout manager |
| `daily_briefing` | Morning summary across all modules |

### Advanced Control
| Tool | Description |
|---|---|
| `start_screen_recording` / `stop_screen_recording` | MP4 to Desktop |
| `list_wifi_networks` / `get_wifi_status` / `connect_wifi` / `disconnect_wifi` / `toggle_wifi` | WiFi |
| `print_file` / `list_printers` | Printing |

### Dev Tools
| Tool | Description |
|---|---|
| `docker_list` / `docker_start` / `docker_stop` / `docker_restart` / `docker_logs` / `docker_images` / `docker_compose` | Docker |
| `list_open_ports` / `check_port` / `ping_host` | Network |
| `git_status` / `git_log` / `git_diff` / `git_pull` / `git_commit` / `git_branches` | Git |
| `http_get` / `http_post` / `get_env_info` | HTTP + environment |

### Calls
| Tool | Description |
|---|---|
| `answer_call` / `decline_call` | Handle incoming OS calls |

### Android (ADB)
| Tool | Description |
|---|---|
| `adb_devices` / `adb_connect` / `adb_pair` | Device connection |
| `adb_home` / `adb_back` / `adb_recent_apps` / `adb_power_button` / `adb_unlock` | Navigation |
| `adb_tap` / `adb_swipe` / `adb_type` / `adb_keyevent` | Input |
| `adb_screenshot` / `adb_list_apps` / `adb_open_app` / `adb_close_app` | Screen + apps |
| `adb_send_sms` / `adb_phone_info` / `adb_push_file` / `adb_pull_file` / `adb_set_volume` | Comms + files |

---

## Dashboard Agent (agents/)

A separate, lighter agent (`agents/apex_agent.py`) serves dashboard module queries. It uses **Ollama only** (no OpenRouter fallback) and has access to a small set of DB-reading tools:

| Tool | Description |
|---|---|
| `get_dsa_progress` / `get_dsa_problems_due` / `get_next_dsa_problem` / `get_dsa_weak_categories` | NeetCode 150 |
| `get_language_progress` / `get_vocab_due` / `get_language_sessions_this_week` | Language learning |
| `get_research_queue` / `get_research_stats` | Research papers |

This agent is intentionally read-only and module-scoped; it does not have access to system tools.

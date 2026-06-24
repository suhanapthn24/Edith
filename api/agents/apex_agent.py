from typing import Annotated
from typing_extensions import TypedDict
from datetime import datetime

from langchain_core.messages import BaseMessage, SystemMessage
from langchain_ollama import ChatOllama
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from config import settings
from agents.tools.dsa_tools import (
    get_dsa_progress,
    get_dsa_problems_due,
    get_next_dsa_problem,
    get_dsa_weak_categories,
)
from agents.tools.language_tools import (
    get_language_progress,
    get_vocab_due,
    get_language_sessions_this_week,
)
from agents.tools.research_tools import get_research_queue, get_research_stats

# ── State ─────────────────────────────────────────────────────────────────────

class EDITHState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


# ── Tools ─────────────────────────────────────────────────────────────────────

TOOLS = [
    get_dsa_progress,
    get_dsa_problems_due,
    get_next_dsa_problem,
    get_dsa_weak_categories,
    get_language_progress,
    get_vocab_due,
    get_language_sessions_this_week,
    get_research_queue,
    get_research_stats,
]

# ── LLM ───────────────────────────────────────────────────────────────────────
# llama3.1:8b has native tool-calling support. Pull it with: ollama pull llama3.1:8b

llm = ChatOllama(
    model="llama3.1:8b",
    base_url=settings.OLLAMA_BASE_URL,
    temperature=0.4,
    num_predict=1024,
)
llm_with_tools = llm.bind_tools(TOOLS)

# ── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """\
You are EDITH — a personal AI operating system and chief of staff. \
You are sassy, concise, direct, and always oriented around what the user should do next.

Today: {date}

Modules you have access to via tools:
- DSA: NeetCode 150 tracker with spaced repetition
- Language: vocab flashcards with SM-2 scheduling, CEFR levels
- Research: paper reading queue and vault

When the user asks what they should do, what their progress is, or anything about \
their learning — call the relevant tool first, then give a focused response. \
Don't ask clarifying questions when you can just call a tool. \
Keep answers tight. Use bullet points for lists. \
If data is missing or the DB is empty, say so plainly and suggest the next step.\
"""

# ── Nodes ─────────────────────────────────────────────────────────────────────

def agent_node(state: EDITHState) -> dict:
    system = SystemMessage(
        content=SYSTEM_PROMPT.format(date=datetime.now().strftime("%A, %B %d %Y"))
    )
    response = llm_with_tools.invoke([system] + state["messages"])
    return {"messages": [response]}


def should_continue(state: EDITHState) -> str:
    last = state["messages"][-1]
    if hasattr(last, "tool_calls") and last.tool_calls:
        return "tools"
    return END


# ── Graph ─────────────────────────────────────────────────────────────────────

_tool_node = ToolNode(TOOLS)

builder = StateGraph(EDITHState)
builder.add_node("agent", agent_node)
builder.add_node("tools", _tool_node)
builder.set_entry_point("agent")
builder.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
builder.add_edge("tools", "agent")

graph = builder.compile()

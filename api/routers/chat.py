import json
from typing import Optional
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

from agent.apex import graph

router = APIRouter(prefix="/api/v1/chat", tags=["chat"])

_sessions: dict[str, list] = {}


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class ClearRequest(BaseModel):
    session_id: str = "default"


def _sse(data: dict) -> str:
    return f"data: {json.dumps(data)}\n\n"


async def _stream(req: ChatRequest):
    history = list(_sessions.get(req.session_id, []))
    history.append(HumanMessage(content=req.message))

    location = ""
    if req.latitude is not None and req.longitude is not None:
        location = f"{req.latitude},{req.longitude}"

    config = {"configurable": {"location": location}}

    try:
        final_messages = None

        async for event in graph.astream_events(
            {"messages": history},
            config=config,
            version="v2",
        ):
            kind = event["event"]
            name = event.get("name", "")

            if kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                text = chunk.content if isinstance(chunk.content, str) else ""
                if text:
                    yield _sse({"type": "token", "content": text})

            elif kind == "on_tool_start":
                yield _sse({
                    "type": "tool_start",
                    "tool": name,
                    "input": event["data"].get("input", {}),
                })

            elif kind == "on_tool_end":
                out = event["data"].get("output", "")
                if hasattr(out, "content"):
                    out = out.content
                yield _sse({
                    "type": "tool_end",
                    "tool": name,
                    "output": str(out),
                })

            elif kind == "on_chain_end":
                output = event["data"].get("output")
                if isinstance(output, dict) and "messages" in output:
                    final_messages = output["messages"]

        if final_messages:
            _sessions[req.session_id] = final_messages

        yield _sse({"type": "done"})

    except Exception as e:
        yield _sse({"type": "error", "content": str(e)})


@router.post("/stream")
async def stream_chat(req: ChatRequest):
    return StreamingResponse(
        _stream(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/clear")
async def clear_chat(req: ClearRequest):
    _sessions.pop(req.session_id, None)
    return {"ok": True}

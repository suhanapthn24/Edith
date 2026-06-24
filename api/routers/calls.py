"""SSE stream that pushes incoming call events to the frontend."""

import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from services.call_monitor import add_listener, remove_listener, get_call_state

router = APIRouter(prefix="/api/v1/calls", tags=["calls"])


@router.get("/status")
async def call_status():
    return get_call_state()


@router.get("/stream")
async def call_stream():
    queue: asyncio.Queue = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def on_event(event: dict) -> None:
        loop.call_soon_threadsafe(queue.put_nowait, event)

    add_listener(on_event)

    async def generate():
        try:
            # Send current state immediately so frontend can sync on connect
            yield f"data: {json.dumps(get_call_state())}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=20)
                    yield f"data: {json.dumps(event)}\n\n"
                except asyncio.TimeoutError:
                    yield "data: {\"type\":\"ping\"}\n\n"
        finally:
            remove_listener(on_event)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

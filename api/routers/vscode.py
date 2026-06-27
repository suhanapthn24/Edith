"""
VS Code integration — push file/error context from the terminal directly into EDITH's session.

Usage from any terminal:
  # Explain the current file
  cat myfile.py | curl -s -X POST http://localhost:8000/api/v1/vscode/context \
    -H "Content-Type: application/json" \
    -d @- <<< "$(python3 -c "import json,sys; print(json.dumps({'content': sys.stdin.read(), 'message': 'explain this file'}))")"

  # Pipe an error
  npm run build 2>&1 | curl -s -X POST http://localhost:8000/api/v1/vscode/context \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"$(cat)\", \"message\": \"fix this error\"}"

Then say 'explain this' or ask EDITH directly — the context is already in your session.

Add to VS Code tasks.json to bind to a shortcut:
  { "label": "Ask EDITH", "type": "shell",
    "command": "curl -s -X POST http://localhost:8000/api/v1/vscode/context -H 'Content-Type: application/json' -d '{\"content\": \"${selectedText}\", \"file_path\": \"${file}\", \"message\": \"explain this\"}'" }
"""

from fastapi import APIRouter
from pydantic import BaseModel

from routers.chat import _sessions  # type: ignore
from langchain_core.messages import HumanMessage

router = APIRouter(prefix="/api/v1/vscode", tags=["vscode"])


class VSCodeContext(BaseModel):
    content: str
    file_path: str = ""
    message: str = "Explain this"
    session_id: str = "hologram-default"
    language: str = ""


@router.post("/context")
async def push_context(ctx: VSCodeContext):
    """
    Inject code/error context into EDITH's conversation session.
    The hologram frontend uses session_id='hologram-default' unless overridden.
    After pushing, say 'EDITH [your question]' and she'll have the context.
    """
    parts = []
    if ctx.file_path:
        parts.append(f"File: {ctx.file_path}")
    if ctx.language:
        parts.append(f"Language: {ctx.language}")
    lang_hint = f"```{ctx.language}\n" if ctx.language else "```\n"
    msg = "\n".join(filter(None, [
        "\n".join(parts),
        f"{ctx.message}:\n\n{lang_hint}{ctx.content[:4000]}\n```",
    ]))

    history = list(_sessions.get(ctx.session_id, []))
    history.append(HumanMessage(content=msg))
    _sessions[ctx.session_id] = history

    return {
        "ok": True,
        "session_id": ctx.session_id,
        "chars": len(ctx.content),
        "hint": f"Context injected. Now say 'EDITH {ctx.message.lower()}' or type in the hologram.",
    }


@router.delete("/context")
async def clear_context(session_id: str = "hologram-default"):
    """Clear injected context for a session."""
    _sessions.pop(session_id, None)
    return {"ok": True}


@router.get("/snippet")
async def get_curl_snippet(file_path: str = "", message: str = "explain this"):
    """Returns a ready-to-copy curl command for pushing context."""
    return {
        "curl": (
            f'curl -s -X POST http://localhost:8000/api/v1/vscode/context '
            f'-H "Content-Type: application/json" '
            f'-d \'{{"content": "<your code here>", "file_path": "{file_path}", '
            f'"message": "{message}"}}\''
        )
    }

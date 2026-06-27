"""
Local STT endpoint — transcribes audio using openai-whisper (CPU).
Install: pip install openai-whisper ffmpeg-python
Frontend posts audio/webm blob, gets back {"text": "..."}
"""

import asyncio
import os
import tempfile
from typing import Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/v1/stt", tags=["stt"])

_model = None
_model_lock = asyncio.Lock()


def _get_model():
    global _model
    if _model is None:
        import whisper  # type: ignore
        size = os.getenv("WHISPER_MODEL", "base")
        _model = whisper.load_model(size)
    return _model


@router.get("/health")
async def health():
    """Frontend polls this to decide whether to use local vs browser STT."""
    try:
        import whisper  # type: ignore  # noqa: F401
        return {"available": True, "model": os.getenv("WHISPER_MODEL", "base")}
    except ImportError:
        return JSONResponse({"available": False, "reason": "openai-whisper not installed"}, status_code=503)


@router.post("/")
async def transcribe(
    audio: UploadFile = File(...),
    lang: Optional[str] = None,
):
    """
    Transcribe uploaded audio.
    audio: any format whisper accepts (webm, wav, mp3, ogg, m4a)
    lang: ISO language code, e.g. 'en', 'hi', 'es'. None = auto-detect.
    Returns: {"text": "transcript string"}
    """
    try:
        import whisper  # type: ignore  # noqa: F401
    except ImportError:
        raise HTTPException(503, "openai-whisper not installed. Run: pip install openai-whisper")

    content = await audio.read()
    if not content:
        raise HTTPException(400, "Empty audio file")

    suffix = ".webm"
    if audio.filename:
        ext = os.path.splitext(audio.filename)[1]
        if ext:
            suffix = ext

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(content)
        tmp_path = f.name

    try:
        async with _model_lock:
            model = await asyncio.to_thread(_get_model)
            kwargs: dict = {}
            if lang and lang not in ("en", "en-US", "en-GB"):
                kwargs["language"] = lang.split("-")[0]  # "hi-IN" → "hi"
            result = await asyncio.to_thread(model.transcribe, tmp_path, **kwargs)
        text = (result.get("text") or "").strip()
        return {"text": text, "language": result.get("language", lang or "en")}
    except Exception as e:
        raise HTTPException(500, f"Transcription failed: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

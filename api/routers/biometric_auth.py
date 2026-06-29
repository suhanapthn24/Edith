"""Biometric authentication endpoints."""

import asyncio
import os
import tempfile

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from services import biometric

router = APIRouter(prefix="/api/v1/auth/biometric", tags=["biometric"])


class FacePayload(BaseModel):
    embedding: list[float]


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def status():
    return biometric.get_status()


# ── Face (descriptor comparison runs in browser; backend only stores/returns) ─

@router.post("/enroll/face")
async def enroll_face(payload: FacePayload):
    biometric.store_face(payload.embedding)
    return {"success": True}


@router.get("/face-embedding")
async def face_embedding():
    emb = biometric.get_face()
    if emb is None:
        raise HTTPException(404, "No face enrolled")
    return {"embedding": emb}


# ── Voice ─────────────────────────────────────────────────────────────────────

@router.post("/enroll/voice")
async def enroll_voice(audio: UploadFile = File(...)):
    embedding = await _extract_voice_embedding(audio)
    biometric.store_voice(embedding)
    return {"success": True}


@router.post("/verify/voice")
async def verify_voice(audio: UploadFile = File(...)):
    embedding = await _extract_voice_embedding(audio)
    verified, similarity = biometric.verify_voice(embedding)
    return {"verified": verified, "similarity": similarity}


# ── Reset ─────────────────────────────────────────────────────────────────────

@router.delete("/reset")
async def reset():
    from pathlib import Path
    p = Path(__file__).parent.parent / "biometric_data.json"
    if p.exists():
        p.unlink()
    return {"success": True}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _extract_voice_embedding(audio: UploadFile) -> list[float]:
    content = await audio.read()
    if not content:
        raise HTTPException(400, "Empty audio")

    suffix = os.path.splitext(audio.filename or "audio.wav")[1] or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(content)
        tmp = f.name

    try:
        return await asyncio.to_thread(_compute_voice_embedding, tmp)
    except Exception as e:
        raise HTTPException(500, f"Voice embedding failed: {e}")
    finally:
        try:
            os.unlink(tmp)
        except OSError:
            pass


def _compute_voice_embedding(path: str) -> list[float]:
    """Extract voice embedding — tries resemblyzer first, then librosa MFCC."""
    try:
        from resemblyzer import VoiceEncoder, preprocess_wav  # type: ignore
        encoder = VoiceEncoder()
        wav = preprocess_wav(path)
        return encoder.embed_utterance(wav).tolist()
    except ImportError:
        pass

    try:
        import librosa  # type: ignore
        import numpy as np
        y, sr = librosa.load(path, sr=16000, mono=True)
        mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=40)
        delta = librosa.feature.delta(mfcc)
        feat = np.concatenate([mfcc.mean(1), delta.mean(1)])
        return feat.tolist()
    except ImportError:
        pass

    raise RuntimeError(
        "No voice library found. Install one: pip install resemblyzer  OR  pip install librosa"
    )

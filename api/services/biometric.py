"""Biometric embedding storage and comparison utilities."""

import json
import numpy as np
from pathlib import Path

EMBEDDINGS_FILE = Path(__file__).parent.parent / "biometric_data.json"


def _load() -> dict:
    if EMBEDDINGS_FILE.exists():
        return json.loads(EMBEDDINGS_FILE.read_text())
    return {}


def _save(data: dict):
    EMBEDDINGS_FILE.write_text(json.dumps(data))


def cosine_sim(a: list, b: list) -> float:
    va, vb = np.array(a, dtype=float), np.array(b, dtype=float)
    norm = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(np.dot(va, vb) / norm) if norm > 1e-10 else 0.0


# ── Face (128-dim descriptor stored as list, comparison done in browser) ──────

def store_face(embedding: list[float]):
    data = _load()
    data["face"] = embedding
    _save(data)


def get_face() -> list[float] | None:
    return _load().get("face")


def has_face() -> bool:
    return "face" in _load()


# ── Voice ─────────────────────────────────────────────────────────────────────

def store_voice(embedding: list[float]):
    data = _load()
    data["voice"] = embedding
    _save(data)


def verify_voice(embedding: list[float], threshold: float = 0.82) -> tuple[bool, float]:
    stored = _load().get("voice")
    if stored is None:
        return False, 0.0
    sim = cosine_sim(embedding, stored)
    return sim >= threshold, round(sim, 4)


def has_voice() -> bool:
    return "voice" in _load()


def get_status() -> dict:
    return {"face": has_face(), "voice": has_voice()}

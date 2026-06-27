"""
Global hotkey daemon — press Ctrl+Shift+E from anywhere to wake EDITH.
Broadcasts {"type": "wake"} to all connected hologram clients via WebSocket.

Requires: pip install keyboard
Note: on Windows, 'keyboard' may need to run as Administrator for global hooks.
If permissions fail, falls back silently (voice button in browser still works).
"""

import asyncio
import threading
from typing import Optional


_loop: Optional[asyncio.AbstractEventLoop] = None


def _on_hotkey() -> None:
    if _loop is None or _loop.is_closed():
        return
    from routers.hologram import manager  # type: ignore
    asyncio.run_coroutine_threadsafe(
        manager.broadcast({"type": "wake"}),
        _loop,
    )


def _run() -> None:
    try:
        import keyboard  # type: ignore

        # Ctrl+Shift+E — wake EDITH from anywhere
        keyboard.add_hotkey("ctrl+shift+e", _on_hotkey, suppress=False)

        # Ctrl+Shift+S — stop current TTS (useful when EDITH is speaking)
        def _stop():
            if _loop and not _loop.is_closed():
                from routers.hologram import manager  # type: ignore
                asyncio.run_coroutine_threadsafe(
                    manager.broadcast({"type": "stop_speech"}),
                    _loop,
                )

        keyboard.add_hotkey("ctrl+shift+s", _stop, suppress=False)
        keyboard.wait()  # blocks the thread forever
    except ImportError:
        pass  # keyboard not installed — silently skip
    except Exception:
        pass  # permission denied or other OS error — silently skip


def start(loop: asyncio.AbstractEventLoop) -> None:
    """Start the hotkey daemon in a background daemon thread."""
    global _loop
    _loop = loop
    t = threading.Thread(target=_run, daemon=True, name="hotkey-daemon")
    t.start()

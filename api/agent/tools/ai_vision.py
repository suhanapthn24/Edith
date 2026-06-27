"""
AI vision tools: Claude screen analysis, OCR, text location on screen.
Requires: pip install anthropic pillow pytesseract
Also: Tesseract OCR binary from https://github.com/UB-Mannheim/tesseract/wiki
"""

import base64
import io
import os
from langchain_core.tools import tool


def _screenshot_png_b64() -> str:
    from PIL import ImageGrab
    img = ImageGrab.grab()
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.standard_b64encode(buf.getvalue()).decode()


def _get_anthropic_key() -> str | None:
    try:
        from config import settings  # type: ignore
        key = getattr(settings, "ANTHROPIC_API_KEY", None)
        if key and not key.startswith("sk-ant-api03-XXXXX"):
            return key
    except Exception:
        pass
    return os.getenv("ANTHROPIC_API_KEY")


@tool
def ask_about_screen(question: str = "What is currently on the screen? Describe in detail.") -> str:
    """Take a screenshot and ask Claude to analyze/describe it.
    Use for: 'what's on my screen', 'read that error', 'what does this website say',
    'explain what I'm looking at', 'what is this dialog box asking'.
    question: what you want to know about the screen."""
    key = _get_anthropic_key()
    if not key:
        return "Anthropic API key not configured. Add ANTHROPIC_API_KEY to api/.env"
    try:
        import anthropic
        b64 = _screenshot_png_b64()
        client = anthropic.Anthropic(api_key=key)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": "image/png", "data": b64},
                    },
                    {"type": "text", "text": question},
                ],
            }],
        )
        return msg.content[0].text
    except ImportError:
        return "Anthropic SDK not installed. Run: pip install anthropic"
    except Exception as e:
        return f"Screen analysis failed: {e}"


@tool
def read_screen_text() -> str:
    """Extract all visible text from the current screen using OCR (Tesseract).
    Use for: 'read what's on screen', 'copy text from this window', 'what does that say'."""
    try:
        from PIL import ImageGrab
        import pytesseract  # type: ignore
        img = ImageGrab.grab()
        text = pytesseract.image_to_string(img, config="--psm 6")
        cleaned = "\n".join(l for l in text.splitlines() if l.strip())
        return cleaned[:2500] if cleaned else "No readable text found on screen."
    except ImportError:
        return (
            "OCR requires: pip install pytesseract Pillow\n"
            "Also install Tesseract binary: https://github.com/UB-Mannheim/tesseract/wiki"
        )
    except Exception as e:
        return f"OCR failed: {e}"


@tool
def find_text_on_screen(text: str) -> str:
    """Find the screen coordinates of specific text visible on screen.
    Returns the (x, y) center point — useful before calling click_at().
    text: the exact word or phrase to find."""
    try:
        from PIL import ImageGrab
        import pytesseract
        import numpy as np

        img = ImageGrab.grab()
        data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
        matches = []
        for i, word in enumerate(data["text"]):
            if text.lower() in str(word).lower() and int(data["conf"][i]) > 40:
                x = data["left"][i] + data["width"][i] // 2
                y = data["top"][i] + data["height"][i] // 2
                matches.append(f"'{word}' at ({x}, {y})")
        if matches:
            return f"Found '{text}' at: " + "; ".join(matches[:5])
        return f"Text '{text}' not found on screen."
    except ImportError:
        return "Requires: pip install pytesseract Pillow"
    except Exception as e:
        return f"Failed: {e}"


@tool
def screenshot_region_text(x: int, y: int, width: int, height: int) -> str:
    """OCR a specific region of the screen instead of the full display.
    Useful for reading a single window, dialog box, or text area.
    x,y: top-left corner; width,height: region size in pixels."""
    try:
        from PIL import ImageGrab
        import pytesseract
        img = ImageGrab.grab(bbox=(x, y, x + width, y + height))
        text = pytesseract.image_to_string(img, config="--psm 6")
        cleaned = "\n".join(l for l in text.splitlines() if l.strip())
        return cleaned[:2000] if cleaned else "No text found in region."
    except ImportError:
        return "Requires: pip install pytesseract Pillow"
    except Exception as e:
        return f"Failed: {e}"


@tool
def analyze_screenshot_file(path: str, question: str = "Describe this image.") -> str:
    """Analyze a saved screenshot or image file with Claude vision.
    path: absolute path to the image file.
    question: what to ask about the image."""
    import os
    from pathlib import Path
    p = Path(path) if Path(path).is_absolute() else Path.home() / "Desktop" / path
    if not p.exists():
        return f"File not found: {p}"
    key = _get_anthropic_key()
    if not key:
        return "Anthropic API key not configured."
    try:
        import anthropic
        with open(p, "rb") as f:
            b64 = base64.standard_b64encode(f.read()).decode()
        ext = p.suffix.lower().lstrip(".")
        media_type = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                      "png": "image/png", "gif": "image/gif",
                      "webp": "image/webp"}.get(ext, "image/png")
        client = anthropic.Anthropic(api_key=key)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
                    {"type": "text", "text": question},
                ],
            }],
        )
        return msg.content[0].text
    except ImportError:
        return "Requires: pip install anthropic"
    except Exception as e:
        return f"Analysis failed: {e}"

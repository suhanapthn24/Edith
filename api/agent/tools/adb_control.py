"""
Android phone control via ADB (Android Debug Bridge).

Setup:
  1. Install ADB: https://developer.android.com/studio/releases/platform-tools
     Or: winget install Google.PlatformTools
  2. Enable Developer Options on phone → USB Debugging ON
  3. Connect phone via USB (or enable Wireless ADB in Developer Options)
  4. Run: adb devices  — accept the prompt on your phone

Wireless ADB (Android 11+):
  Phone → Developer Options → Wireless debugging → Pair device with pairing code
  Then: adb pair <ip>:<port>   followed by   adb connect <ip>:<port2>
"""

import base64
import subprocess
import time
from pathlib import Path

from langchain_core.tools import tool


def _adb(*args: str, timeout: int = 15) -> tuple[str, int]:
    try:
        r = subprocess.run(
            ["adb"] + list(args),
            capture_output=True, text=True, timeout=timeout,
        )
        return (r.stdout + r.stderr).strip(), r.returncode
    except FileNotFoundError:
        return ("ADB not found. Install Android Platform Tools: "
                "winget install Google.PlatformTools  "
                "or download from https://developer.android.com/studio/releases/platform-tools"), 1
    except subprocess.TimeoutExpired:
        return "ADB command timed out.", 1


def _check_device() -> str | None:
    out, code = _adb("devices")
    if code != 0:
        return out
    lines = [l for l in out.splitlines()[1:] if l.strip() and "\t" in l]
    if not lines:
        return ("No Android device found. "
                "Connect phone via USB with USB Debugging enabled, "
                "or run: adb connect <phone-ip>:5555")
    if "unauthorized" in lines[0]:
        return "Device found but unauthorized — accept the USB debugging prompt on your phone."
    return None


# ── Connection ───────────────────────────────────────────────────────────────

@tool
def adb_devices() -> str:
    """List all connected Android devices/emulators detected by ADB."""
    out, _ = _adb("devices", "-l")
    return out or "No devices listed."


@tool
def adb_connect(ip_port: str) -> str:
    """Connect to an Android device over WiFi using ADB.
    ip_port: device IP and port, e.g. '192.168.1.5:5555'
    (Enable Wireless Debugging in Developer Options first, then pair with adb_pair)."""
    out, code = _adb("connect", ip_port)
    return out


@tool
def adb_pair(ip_port: str, code: str) -> str:
    """Pair with an Android 11+ device for wireless ADB using a pairing code.
    ip_port: shown in Developer Options → Wireless Debugging → Pair device.
    code: the 6-digit pairing code shown on the phone."""
    out, rc = _adb("pair", ip_port, code)
    return out


# ── Navigation ───────────────────────────────────────────────────────────────

@tool
def adb_home() -> str:
    """Press the Home button on the connected Android phone."""
    err = _check_device()
    if err:
        return err
    _adb("shell", "input", "keyevent", "KEYCODE_HOME")
    return "Home button pressed."


@tool
def adb_back() -> str:
    """Press the Back button on the connected Android phone."""
    err = _check_device()
    if err:
        return err
    _adb("shell", "input", "keyevent", "KEYCODE_BACK")
    return "Back button pressed."


@tool
def adb_recent_apps() -> str:
    """Open the Recent Apps / multitasking screen on the phone."""
    err = _check_device()
    if err:
        return err
    _adb("shell", "input", "keyevent", "KEYCODE_APP_SWITCH")
    return "Opened recent apps."


@tool
def adb_power_button() -> str:
    """Simulate pressing the power button (wake/sleep the phone screen)."""
    err = _check_device()
    if err:
        return err
    _adb("shell", "input", "keyevent", "KEYCODE_POWER")
    return "Power button pressed."


@tool
def adb_unlock(pin: str = "") -> str:
    """Wake and unlock the phone screen. pin: optional numeric PIN to enter after swipe-up."""
    err = _check_device()
    if err:
        return err
    # Wake up
    _adb("shell", "input", "keyevent", "KEYCODE_WAKEUP")
    time.sleep(0.5)
    # Swipe up to dismiss lock screen
    _adb("shell", "input", "swipe", "540", "1600", "540", "800", "300")
    time.sleep(0.4)
    if pin:
        _adb("shell", "input", "text", pin)
        time.sleep(0.2)
        _adb("shell", "input", "keyevent", "KEYCODE_ENTER")
    return "Screen unlocked."


# ── Touch & Input ─────────────────────────────────────────────────────────────

@tool
def adb_tap(x: int, y: int) -> str:
    """Tap the phone screen at coordinates (x, y).
    Coordinates are in physical pixels — use adb_screenshot to see the screen first."""
    err = _check_device()
    if err:
        return err
    _adb("shell", "input", "tap", str(x), str(y))
    return f"Tapped ({x}, {y})."


@tool
def adb_swipe(x1: int, y1: int, x2: int, y2: int, duration_ms: int = 300) -> str:
    """Swipe on the phone screen from (x1,y1) to (x2,y2).
    duration_ms: swipe speed in milliseconds (default 300)."""
    err = _check_device()
    if err:
        return err
    _adb("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(duration_ms))
    return f"Swiped ({x1},{y1}) → ({x2},{y2})."


@tool
def adb_type(text: str) -> str:
    """Type text into the currently focused input field on the phone.
    Note: special characters may need escaping. Works best with simple alphanumeric text."""
    err = _check_device()
    if err:
        return err
    safe = text.replace(" ", "%s").replace("&", "\\&").replace("<", "\\<")
    _adb("shell", "input", "text", safe)
    return f"Typed: {text[:80]}"


@tool
def adb_keyevent(keycode: str) -> str:
    """Send an Android keycode to the phone.
    Common keycodes: KEYCODE_ENTER, KEYCODE_DEL, KEYCODE_VOLUME_UP, KEYCODE_VOLUME_DOWN,
    KEYCODE_MEDIA_PLAY_PAUSE, KEYCODE_MEDIA_NEXT, KEYCODE_MEDIA_PREVIOUS."""
    err = _check_device()
    if err:
        return err
    _adb("shell", "input", "keyevent", keycode)
    return f"Sent keyevent: {keycode}"


# ── Screenshot ────────────────────────────────────────────────────────────────

@tool
def adb_screenshot(filename: str = "") -> str:
    """Take a screenshot of the phone screen and save it to Desktop.
    filename: optional name (no extension needed)."""
    err = _check_device()
    if err:
        return err
    from datetime import datetime
    fn = (filename.strip() or f"phone_{datetime.now().strftime('%Y%m%d_%H%M%S')}") + ".png"
    save_path = Path.home() / "Desktop" / fn
    _adb("shell", "screencap", "-p", "/sdcard/edith_screen.png")
    time.sleep(0.3)
    out, code = _adb("pull", "/sdcard/edith_screen.png", str(save_path))
    _adb("shell", "rm", "/sdcard/edith_screen.png")
    if save_path.exists():
        return f"Phone screenshot saved to Desktop: {fn}"
    return out or "Screenshot failed."


# ── Apps ──────────────────────────────────────────────────────────────────────

@tool
def adb_list_apps(filter_str: str = "") -> str:
    """List installed apps on the phone.
    filter_str: optional keyword to filter package names (e.g. 'whatsapp', 'google')."""
    err = _check_device()
    if err:
        return err
    out, _ = _adb("shell", "pm", "list", "packages", "-3")  # -3 = third-party only
    lines = [l.replace("package:", "").strip() for l in out.splitlines() if l.startswith("package:")]
    if filter_str:
        lines = [l for l in lines if filter_str.lower() in l.lower()]
    return "Installed apps:\n" + "\n".join(f"• {l}" for l in sorted(lines)[:40]) if lines else "No apps found."


@tool
def adb_open_app(package_name: str) -> str:
    """Open an app on the phone by its package name.
    Examples: 'com.whatsapp', 'com.instagram.android', 'com.spotify.music'
    Use adb_list_apps to find the exact package name."""
    err = _check_device()
    if err:
        return err
    out, code = _adb("shell", "monkey", "-p", package_name, "-c",
                     "android.intent.category.LAUNCHER", "1")
    if "Events injected: 1" in out or code == 0:
        return f"Opened {package_name}."
    return out or f"Could not open {package_name}."


@tool
def adb_close_app(package_name: str) -> str:
    """Force-stop an app on the phone by package name."""
    err = _check_device()
    if err:
        return err
    out, code = _adb("shell", "am", "force-stop", package_name)
    return f"Force-stopped {package_name}." if code == 0 else out


# ── Notifications & SMS ───────────────────────────────────────────────────────

@tool
def adb_send_sms(phone_number: str, message: str) -> str:
    """Send an SMS from the phone using the default SMS app via ADB intent.
    phone_number: recipient number. message: text to send."""
    err = _check_device()
    if err:
        return err
    safe_msg = message.replace(" ", "%20").replace("&", "%26")
    out, code = _adb(
        "shell", "am", "start",
        "-a", "android.intent.action.SENDTO",
        "-d", f"smsto:{phone_number}",
        "--es", "sms_body", message,
        "--ez", "exit_on_sent", "true",
    )
    return f"Opened SMS composer to {phone_number}. Tap Send on the phone." if code == 0 else out


@tool
def adb_phone_info() -> str:
    """Get basic info about the connected phone: model, Android version, battery, storage."""
    err = _check_device()
    if err:
        return err
    model, _ = _adb("shell", "getprop", "ro.product.model")
    android, _ = _adb("shell", "getprop", "ro.build.version.release")
    battery_raw, _ = _adb("shell", "dumpsys", "battery")
    storage_raw, _ = _adb("shell", "df", "/sdcard")

    battery = "?"
    for line in battery_raw.splitlines():
        if "level:" in line:
            battery = line.split(":")[1].strip() + "%"
            break

    storage = ""
    for line in storage_raw.splitlines()[1:2]:
        parts = line.split()
        if len(parts) >= 4:
            storage = f"{parts[3]} free of {parts[1]}"

    return (
        f"Model: {model}\n"
        f"Android: {android}\n"
        f"Battery: {battery}\n"
        f"Storage: {storage}"
    )


# ── File Transfer ─────────────────────────────────────────────────────────────

@tool
def adb_push_file(local_path: str, phone_path: str = "/sdcard/") -> str:
    """Copy a file FROM the laptop TO the phone.
    local_path: file on laptop (absolute or Desktop-relative).
    phone_path: destination on phone (default: /sdcard/)."""
    p = Path(local_path) if Path(local_path).is_absolute() else Path.home() / "Desktop" / local_path
    if not p.exists():
        return f"File not found: {p}"
    err = _check_device()
    if err:
        return err
    out, code = _adb("push", str(p), phone_path, timeout=60)
    return f"Pushed '{p.name}' to {phone_path}." if code == 0 else out


@tool
def adb_pull_file(phone_path: str, local_name: str = "") -> str:
    """Copy a file FROM the phone TO the laptop Desktop.
    phone_path: path on phone e.g. '/sdcard/DCIM/photo.jpg'
    local_name: optional filename on Desktop."""
    err = _check_device()
    if err:
        return err
    fname = local_name or Path(phone_path).name
    dest = Path.home() / "Desktop" / fname
    out, code = _adb("pull", phone_path, str(dest), timeout=120)
    return f"Saved '{fname}' to Desktop." if code == 0 else out


# ── Screen Control ────────────────────────────────────────────────────────────

@tool
def adb_set_volume(level: int, stream: str = "music") -> str:
    """Set the phone volume.
    level: 0–15 for music/ring, or 0–7 for alarm.
    stream: 'music', 'ring', 'notification', 'alarm' (default: music)."""
    stream_map = {"music": 3, "ring": 2, "notification": 5, "alarm": 4}
    stream_id = stream_map.get(stream.lower(), 3)
    err = _check_device()
    if err:
        return err
    _adb("shell", "media", "volume", "--stream", str(stream_id), "--set", str(level))
    return f"Phone {stream} volume set to {level}."

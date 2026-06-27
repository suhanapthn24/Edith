"""
Tier 2 system control tools: screen recording, WiFi, printing.
"""

import asyncio
import os
import subprocess
from datetime import datetime
from pathlib import Path

from langchain_core.tools import tool


def _ps(cmd: str, timeout: int = 15) -> str:
    r = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
        capture_output=True, text=True, timeout=timeout,
    )
    return r.stdout.strip()


# ── Screen Recording ─────────────────────────────────────────────────────────

_recording_proc = None


@tool
def start_screen_recording(filename: str = "", duration: int = 0) -> str:
    """Start recording the screen. Saves to Desktop as an MP4.
    filename: optional custom name (no extension needed).
    duration: optional max seconds (0 = record until stop_screen_recording is called).
    Returns the path where the video will be saved."""
    global _recording_proc
    if _recording_proc and _recording_proc.poll() is None:
        return "Recording already in progress. Call stop_screen_recording() first."

    fn = (filename.strip() or f"recording_{datetime.now().strftime('%Y%m%d_%H%M%S')}") + ".mp4"
    save_path = Path.home() / "Desktop" / fn

    try:
        import mss  # type: ignore  # noqa: F401
        import cv2  # type: ignore  # noqa: F401
    except ImportError:
        # Fallback: use FFmpeg if available
        try:
            subprocess.run(["ffmpeg", "-version"], capture_output=True, timeout=5)
            cmd = [
                "ffmpeg", "-y",
                "-f", "gdigrab", "-framerate", "15", "-i", "desktop",
                "-vcodec", "libx264", "-preset", "ultrafast", "-crf", "28",
                str(save_path),
            ]
            if duration > 0:
                cmd = cmd[:4] + ["-t", str(duration)] + cmd[4:]
            _recording_proc = subprocess.Popen(cmd, stdin=subprocess.PIPE,
                                                capture_output=True)
            return f"Recording started (FFmpeg) → {save_path}"
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return ("Screen recording requires 'mss' and 'opencv-python' packages, "
                    "or FFmpeg installed. Run: pip install mss opencv-python")

    # mss + cv2 path — run in background thread
    import threading

    def _record():
        global _recording_proc
        import mss
        import cv2
        import numpy as np

        with mss.mss() as sct:
            monitor = sct.monitors[1]
            w, h = monitor["width"], monitor["height"]
            fourcc = cv2.VideoWriter_fourcc(*"mp4v")
            out = cv2.VideoWriter(str(save_path), fourcc, 15.0, (w, h))
            start = datetime.now()
            while True:
                frame = np.array(sct.grab(monitor))
                frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                out.write(frame)
                if duration > 0 and (datetime.now() - start).seconds >= duration:
                    break
                if _recording_proc == "STOP":
                    break
            out.release()
        _recording_proc = None

    _recording_proc = "RUNNING"
    t = threading.Thread(target=_record, daemon=True)
    t.start()
    return f"Recording started → {save_path}{f' (max {duration}s)' if duration else ''}"


@tool
def stop_screen_recording() -> str:
    """Stop an in-progress screen recording and finalize the video file."""
    global _recording_proc
    if _recording_proc is None:
        return "No recording in progress."
    if _recording_proc == "RUNNING":
        _recording_proc = "STOP"
        return "Recording stopped. Video is being finalized on Desktop."
    # FFmpeg process
    try:
        _recording_proc.communicate(input=b"q", timeout=5)
    except Exception:
        _recording_proc.terminate()
    _recording_proc = None
    return "Recording stopped and saved to Desktop."


# ── WiFi Control ─────────────────────────────────────────────────────────────

@tool
def list_wifi_networks() -> str:
    """List all available WiFi networks and their signal strength."""
    out = _ps("netsh wlan show networks mode=Bssid | Select-String -Pattern 'SSID|Signal' | ForEach-Object { $_.Line.Trim() }")
    if not out:
        out = _ps("netsh wlan show networks")
    if not out or "error" in out.lower():
        return "Could not scan WiFi networks. Make sure WiFi adapter is enabled."

    lines = out.splitlines()
    result = []
    ssid = ""
    for line in lines:
        if line.startswith("SSID") and "BSSID" not in line:
            ssid = line.split(":", 1)[-1].strip()
        elif "Signal" in line and ssid:
            sig = line.split(":", 1)[-1].strip()
            result.append(f"• {ssid}  ({sig})")
            ssid = ""

    return "Available WiFi networks:\n" + "\n".join(result[:15]) if result else out[:800]


@tool
def get_wifi_status() -> str:
    """Get the current WiFi connection status — SSID, signal, IP address."""
    out = _ps("""
$iface = (netsh wlan show interfaces) -join "`n"
$ssid = if ($iface -match 'SSID\s*:\s*(.+)') { $Matches[1].Trim() } else { 'Not connected' }
$signal = if ($iface -match 'Signal\s*:\s*(.+)') { $Matches[1].Trim() } else { 'N/A' }
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -like '*Wi*' } | Select-Object -First 1).IPAddress
"SSID: $ssid | Signal: $signal | IP: $ip"
""")
    return out or "WiFi status unavailable."


@tool
def connect_wifi(ssid: str, password: str = "") -> str:
    """Connect to a WiFi network by SSID. Provide password for secured networks.
    The network must have been connected before (profile saved) if no password given."""
    if password:
        # Create a profile XML and connect
        xml = f"""<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
    <name>{ssid}</name>
    <SSIDConfig><SSID><name>{ssid}</name></SSID></SSIDConfig>
    <connectionType>ESS</connectionType>
    <connectionMode>auto</connectionMode>
    <MSM><security>
        <authEncryption><authentication>WPA2PSK</authentication><encryption>AES</encryption></authEncryption>
        <sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>{password}</keyMaterial></sharedKey>
    </security></MSM>
</WLANProfile>"""
        profile_path = Path(os.environ.get("TEMP", "C:/Temp")) / "edith_wifi_profile.xml"
        profile_path.write_text(xml, encoding="utf-8")
        _ps(f'netsh wlan add profile filename="{profile_path}" user=all')
        profile_path.unlink(missing_ok=True)

    out = _ps(f'netsh wlan connect name="{ssid}"')
    if "successfully" in out.lower() or not out:
        return f"Connecting to '{ssid}'..."
    return out or f"Could not connect to '{ssid}'. Make sure the network is in range."


@tool
def disconnect_wifi() -> str:
    """Disconnect from the current WiFi network."""
    out = _ps("netsh wlan disconnect")
    return out or "Disconnected from WiFi."


@tool
def toggle_wifi(state: str) -> str:
    """Enable or disable the WiFi adapter. state: 'on' or 'off'"""
    state = state.lower().strip()
    if state not in ("on", "off"):
        return "state must be 'on' or 'off'."
    action = "Enable" if state == "on" else "Disable"
    out = _ps(f"Get-NetAdapter | Where-Object {{$_.Name -like '*Wi*' -or $_.InterfaceDescription -like '*Wi*'}} | {action}-NetAdapter -Confirm:$false")
    return f"WiFi turned {state}." if not out or "error" not in out.lower() else out


# ── Print File ────────────────────────────────────────────────────────────────

@tool
def print_file(path: str, printer: str = "") -> str:
    """Print a file using the default (or specified) printer.
    path: file path (absolute or relative to Desktop).
    printer: optional printer name — leave blank for default.
    Supports PDF, Word, images, and text files."""
    from pathlib import Path
    p = Path(path) if Path(path).is_absolute() else Path.home() / "Desktop" / path
    if not p.exists():
        return f"File not found: {p}"

    printer_arg = f'-PrinterName "{printer}"' if printer else ""
    ext = p.suffix.lower()

    # Use Start-Process with -Verb Print for most file types
    ps = f'Start-Process -FilePath "{p}" -Verb Print -Wait'
    if printer:
        # For specific printer, use PrintTo verb
        ps = f'Start-Process -FilePath "{p}" -Verb PrintTo -ArgumentList "{printer}" -Wait'

    # For text files, use notepad with /p flag
    if ext == ".txt":
        ps = f'Start-Process notepad -ArgumentList "/p","{p}" -Wait'

    try:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
            capture_output=True, text=True, timeout=30,
        )
        if r.returncode == 0:
            return f"Sent '{p.name}' to {'default' if not printer else printer} printer."
        return r.stderr.strip() or f"Print failed (exit {r.returncode})."
    except subprocess.TimeoutExpired:
        return f"Print job sent for '{p.name}'."
    except Exception as e:
        return f"Failed to print: {e}"


@tool
def list_printers() -> str:
    """List all installed printers and identify the default printer."""
    out = _ps("""
$printers = Get-Printer | Select-Object Name, Default, PrinterStatus
$printers | ForEach-Object {
    $def = if ($_.Default) { ' [DEFAULT]' } else { '' }
    "• $($_.Name)$def"
}
""")
    return "Installed printers:\n" + out if out else "No printers found."

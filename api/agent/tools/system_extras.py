"""
Extra system control: battery, microphone, power plans, process management.
"""

import subprocess
from langchain_core.tools import tool


def _ps(cmd: str, timeout: int = 12) -> str:
    r = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
        capture_output=True, text=True, timeout=timeout,
    )
    return r.stdout.strip()


# ── Battery ──────────────────────────────────────────────────────────────────

@tool
def get_battery_status() -> str:
    """Get the current battery status: charge level, charging/discharging, time remaining."""
    try:
        import psutil
        b = psutil.sensors_battery()
        if b is None:
            return "No battery detected (desktop PC or battery sensor unavailable)."
        pct = round(b.percent, 1)
        plugged = "Charging" if b.power_plugged else "Discharging"
        if b.secsleft and b.secsleft > 0 and not b.power_plugged:
            h, m = divmod(b.secsleft // 60, 60)
            remaining = f" — {h}h {m}m remaining"
        else:
            remaining = ""
        return f"Battery: {pct}% ({plugged}){remaining}"
    except ImportError:
        out = _ps("(Get-WmiObject Win32_Battery | Select-Object -First 1).EstimatedChargeRemaining")
        return f"Battery: {out}%" if out.isdigit() else "Battery info unavailable."
    except Exception as e:
        return f"Failed: {e}"


# ── Microphone ───────────────────────────────────────────────────────────────

@tool
def mute_microphone() -> str:
    """Mute the system default microphone input device."""
    try:
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume  # type: ignore
        from pycaw.pycaw import AudioUtilities
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL  # type: ignore
        devices = AudioUtilities.GetMicrophone()
        if not devices:
            return "No microphone found."
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        vol = cast(interface, POINTER(IAudioEndpointVolume))
        vol.SetMute(1, None)
        return "Microphone muted."
    except Exception:
        out = _ps("""
$mic = Get-AudioDevice -List | Where-Object {$_.Type -eq 'Recording' -and $_.Default} | Select-Object -First 1
if ($mic) { Set-AudioDevice -Index $mic.Index -Mute $true; "Microphone muted." }
else {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait([char]173)
    "Microphone toggled."
}
""")
        return out or "Muted microphone."


@tool
def unmute_microphone() -> str:
    """Unmute the system default microphone input device."""
    try:
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume  # type: ignore
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL  # type: ignore
        devices = AudioUtilities.GetMicrophone()
        if not devices:
            return "No microphone found."
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        vol = cast(interface, POINTER(IAudioEndpointVolume))
        vol.SetMute(0, None)
        return "Microphone unmuted."
    except Exception:
        return _ps("""
$mic = Get-AudioDevice -List | Where-Object {$_.Type -eq 'Recording' -and $_.Default} | Select-Object -First 1
if ($mic) { Set-AudioDevice -Index $mic.Index -Mute $false; "Microphone unmuted." } else { "No mic found." }
""") or "Unmuted microphone."


@tool
def get_microphone_status() -> str:
    """Check whether the microphone is currently muted or active."""
    try:
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume  # type: ignore
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL  # type: ignore
        devices = AudioUtilities.GetMicrophone()
        if not devices:
            return "No microphone found."
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        vol = cast(interface, POINTER(IAudioEndpointVolume))
        muted = bool(vol.GetMute())
        return f"Microphone is {'MUTED' if muted else 'ACTIVE (unmuted)'}."
    except Exception:
        return "Could not determine microphone status."


# ── Power Plans ──────────────────────────────────────────────────────────────

_POWER_PLANS = {
    "balanced":    "381b4222-f694-41f0-9685-ff5bb260df2e",
    "performance": "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c",
    "saver":       "a1841308-3541-4fab-bc81-f71556f20b4a",
    "power saver": "a1841308-3541-4fab-bc81-f71556f20b4a",
    "high performance": "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c",
}

@tool
def set_power_plan(plan: str) -> str:
    """Set the Windows power plan. plan: 'balanced', 'performance', or 'saver'."""
    key = plan.lower().strip()
    guid = _POWER_PLANS.get(key)
    if not guid:
        return f"Unknown plan '{plan}'. Use: balanced, performance, or saver."
    try:
        subprocess.run(["powercfg", "/setactive", guid], capture_output=True, check=True)
        return f"Power plan set to: {plan}."
    except Exception as e:
        return f"Failed: {e}"


@tool
def get_power_plan() -> str:
    """Get the currently active Windows power plan."""
    out = _ps("powercfg /getactivescheme")
    return out or "Could not get power plan."


# ── Process Management ───────────────────────────────────────────────────────

@tool
def kill_process(name_or_pid: str) -> str:
    """Force-kill a process by name or PID.
    Examples: 'chrome.exe', 'notepad', '1234' (PID)"""
    target = name_or_pid.strip()
    try:
        import psutil
        killed = []
        if target.isdigit():
            p = psutil.Process(int(target))
            name = p.name()
            p.kill()
            killed.append(f"{name} (PID {target})")
        else:
            proc_name = target if target.endswith(".exe") else target + ".exe"
            for p in psutil.process_iter(["name", "pid"]):
                if p.info["name"] and (
                    p.info["name"].lower() == target.lower() or
                    p.info["name"].lower() == proc_name.lower()
                ):
                    p.kill()
                    killed.append(f"{p.info['name']} (PID {p.info['pid']})")
        return f"Killed: {', '.join(killed)}" if killed else f"No process found matching '{target}'."
    except ImportError:
        r = subprocess.run(["taskkill", "/f", "/im", target if "." in target else target + ".exe"],
                           capture_output=True, text=True)
        return r.stdout.strip() or f"Kill attempted for '{target}'."
    except Exception as e:
        return f"Failed: {e}"


@tool
def get_process_details(name: str) -> str:
    """Get CPU and memory usage for a specific running process.
    name: process name like 'chrome', 'code', 'spotify'"""
    try:
        import psutil
        results = []
        for p in psutil.process_iter(["name", "pid", "cpu_percent", "memory_info", "status"]):
            if name.lower() in (p.info["name"] or "").lower():
                mem_mb = (p.info["memory_info"].rss // 1024 // 1024) if p.info["memory_info"] else 0
                results.append(
                    f"• {p.info['name']} PID {p.info['pid']} — "
                    f"CPU: {p.info['cpu_percent']}%  RAM: {mem_mb} MB  [{p.info['status']}]"
                )
        return "\n".join(results[:10]) if results else f"No process found matching '{name}'."
    except ImportError:
        return "Requires psutil: pip install psutil"
    except Exception as e:
        return f"Failed: {e}"


@tool
def list_top_processes(count: int = 10) -> str:
    """List the top processes sorted by CPU usage.
    count: how many to show (default 10)."""
    try:
        import psutil
        procs = []
        for p in psutil.process_iter(["name", "pid", "cpu_percent", "memory_info"]):
            try:
                mem = (p.info["memory_info"].rss // 1024 // 1024) if p.info["memory_info"] else 0
                procs.append((p.info["cpu_percent"], mem, p.info["name"] or "", p.info["pid"]))
            except Exception:
                pass
        procs.sort(reverse=True)
        lines = [f"• {n} (PID {pid}) — CPU {cpu}%  RAM {mem} MB"
                 for cpu, mem, n, pid in procs[:count] if n]
        return "Top processes:\n" + "\n".join(lines) if lines else "No data."
    except ImportError:
        return "Requires psutil."
    except Exception as e:
        return f"Failed: {e}"


# ── Audio Output Device ───────────────────────────────────────────────────────

@tool
def list_audio_devices() -> str:
    """List all audio output and input devices on the system."""
    out = _ps("""
Get-WmiObject Win32_SoundDevice | ForEach-Object {
    "• $($_.Name) [$($_.Status)]"
}
""")
    return "Audio devices:\n" + out if out else "No audio devices found."


@tool
def get_volume() -> str:
    """Get the current system master volume level (0–100)."""
    try:
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume  # type: ignore
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL  # type: ignore
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        vol = cast(interface, POINTER(IAudioEndpointVolume))
        level = round(vol.GetMasterVolumeLevelScalar() * 100)
        muted = bool(vol.GetMute())
        return f"Volume: {level}%{' (muted)' if muted else ''}"
    except Exception:
        return _ps("(Get-AudioDevice -Playback).Volume") or "Volume info unavailable."

import fnmatch
import os
import subprocess
from datetime import datetime
from pathlib import Path

import httpx
from langchain_core.tools import tool

# ── App name → command mappings ───────────────────────────────────────────────

_APP: dict[str, str] = {
    "chrome": "chrome",
    "google chrome": "chrome",
    "firefox": "firefox",
    "edge": "msedge",
    "microsoft edge": "msedge",
    "brave": "brave",
    "notepad": "notepad",
    "notepad++": "notepad++",
    "vscode": "code",
    "vs code": "code",
    "visual studio code": "code",
    "visual studio": "devenv",
    "explorer": "explorer",
    "file explorer": "explorer",
    "files": "explorer",
    "calculator": "calc",
    "calc": "calc",
    "cmd": "cmd",
    "command prompt": "cmd",
    "terminal": "wt",
    "windows terminal": "wt",
    "powershell": "powershell",
    "task manager": "taskmgr",
    "discord": "discord",
    "spotify": "spotify",
    "slack": "slack",
    "zoom": "zoom",
    "teams": "teams",
    "microsoft teams": "teams",
    "outlook": "outlook",
    "word": "winword",
    "excel": "excel",
    "powerpoint": "powerpnt",
    "paint": "mspaint",
    "snipping tool": "snippingtool",
    "snip": "snippingtool",
    "settings": "ms-settings:",
    "windows settings": "ms-settings:",
    "control panel": "control",
    "vlc": "vlc",
    "obs": "obs64",
    "steam": "steam",
    "pycharm": "pycharm",
    "postman": "postman",
    "notion": "notion",
    "whatsapp": "whatsapp",
    "telegram": "telegram",
    "camera": "microsoft.windows.camera:",
}

_PROC: dict[str, str] = {
    "chrome": "chrome.exe",
    "google chrome": "chrome.exe",
    "firefox": "firefox.exe",
    "edge": "msedge.exe",
    "microsoft edge": "msedge.exe",
    "notepad": "notepad.exe",
    "vscode": "Code.exe",
    "vs code": "Code.exe",
    "visual studio code": "Code.exe",
    "discord": "Discord.exe",
    "spotify": "Spotify.exe",
    "slack": "slack.exe",
    "zoom": "Zoom.exe",
    "teams": "Teams.exe",
    "microsoft teams": "Teams.exe",
    "outlook": "OUTLOOK.EXE",
    "word": "WINWORD.EXE",
    "excel": "EXCEL.EXE",
    "powerpoint": "POWERPNT.EXE",
    "explorer": "explorer.exe",
    "paint": "mspaint.exe",
    "terminal": "WindowsTerminal.exe",
    "windows terminal": "WindowsTerminal.exe",
    "task manager": "Taskmgr.exe",
    "taskmgr": "Taskmgr.exe",
}

_FOLDER_ALIAS: dict[str, Path] = {
    "desktop":   Path.home() / "Desktop",
    "documents": Path.home() / "Documents",
    "downloads": Path.home() / "Downloads",
    "pictures":  Path.home() / "Pictures",
    "music":     Path.home() / "Music",
    "videos":    Path.home() / "Videos",
}

_SKIP_PROCS = {
    "svchost.exe", "system", "registry", "smss.exe", "csrss.exe",
    "wininit.exe", "winlogon.exe", "services.exe", "lsass.exe",
    "spoolsv.exe", "dwm.exe", "fontdrvhost.exe", "sihost.exe",
    "taskhostw.exe", "ctfmon.exe", "conhost.exe", "dllhost.exe",
    "audiodg.exe", "wuauclt.exe", "msiexec.exe", "idle",
}


def _launch(exe: str) -> None:
    """Launch an app using ShellExecuteW — respects App Paths registry, no hidden-window issues."""
    import ctypes
    # SW_SHOWNORMAL = 1
    ret = ctypes.windll.shell32.ShellExecuteW(None, "open", exe, None, None, 1)
    if ret <= 32:
        # ShellExecuteW returns >32 on success; fall back to os.system start
        os.system(f'start "" "{exe}"')


# ── Tools ─────────────────────────────────────────────────────────────────────

@tool
def open_app(app_name: str) -> str:
    """Open any application on the user's Windows computer.
    Examples: 'chrome', 'notepad', 'vs code', 'spotify', 'discord',
    'calculator', 'file explorer', 'settings', 'terminal', 'task manager'"""
    exe = _APP.get(app_name.lower().strip(), app_name)
    try:
        _launch(exe)
        return f"Opened {app_name}."
    except Exception as e:
        return f"Failed to open {app_name}: {e}"


@tool
def close_app(app_name: str) -> str:
    """Close a running application by name.
    Examples: 'chrome', 'notepad', 'spotify', 'discord', 'vs code'"""
    name = app_name.lower().strip()
    proc = _PROC.get(name, (name if name.endswith(".exe") else name + ".exe"))

    result = subprocess.run(
        ["taskkill", "/f", "/im", proc],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        return f"Closed {app_name}."

    try:
        import psutil
        killed = False
        for p in psutil.process_iter(["name", "pid"]):
            if p.info["name"] and p.info["name"].lower() == proc.lower():
                p.terminate()
                killed = True
        return f"Closed {app_name}." if killed else f"'{app_name}' doesn't appear to be running."
    except ImportError:
        return f"Could not close {app_name}." if result.returncode != 0 else f"Closed {app_name}."


@tool
def list_running_apps() -> str:
    """List currently running user applications (excludes background system services)."""
    try:
        import psutil
        names = sorted({
            p.info["name"]
            for p in psutil.process_iter(["name"])
            if p.info.get("name") and p.info["name"].lower() not in _SKIP_PROCS
        })
        return "Running apps:\n" + "\n".join(f"• {n}" for n in names[:35])
    except ImportError:
        r = subprocess.run(["tasklist", "/fo", "csv", "/nh"], capture_output=True, text=True)
        names = sorted({
            line.split(",")[0].strip('"')
            for line in r.stdout.splitlines()
            if line and line.split(",")[0].strip('"').lower() not in _SKIP_PROCS
        })
        return "Running processes:\n" + "\n".join(f"• {n}" for n in names[:35])


@tool
def open_file_or_folder(path: str) -> str:
    """Open a file or folder with its default application.
    Accepts full paths or common names: 'desktop', 'documents', 'downloads',
    'pictures', 'music', 'videos'"""
    resolved = _FOLDER_ALIAS.get(path.lower().strip(), Path(path))
    if not resolved.exists():
        return f"Path not found: {path}"
    try:
        os.startfile(str(resolved))
        return f"Opened: {resolved}"
    except Exception as e:
        return f"Failed to open {path}: {e}"


@tool
def find_files(query: str, location: str = "") -> str:
    """Search for files by name on the user's computer. Results sorted newest first.
    query: filename or glob pattern like 'resume', '*.pdf', 'project notes'
    location: optional — 'desktop', 'documents', 'downloads', 'pictures', or a full folder path"""
    if location:
        resolved = _FOLDER_ALIAS.get(location.lower().strip(), Path(location))
        dirs = [resolved] if resolved.exists() else []
        if not dirs:
            return f"Folder not found: {location}"
    else:
        dirs = [Path.home() / d for d in ("Desktop", "Documents", "Downloads", "Pictures")]

    pattern = f"*{query}*" if "*" not in query and "?" not in query else query
    found: list[str] = []

    for d in dirs:
        if not d.exists():
            continue
        for root, sub_dirs, files in os.walk(str(d)):
            sub_dirs[:] = [x for x in sub_dirs if not x.startswith(".")]
            for f in files:
                if fnmatch.fnmatch(f.lower(), pattern.lower()):
                    found.append(os.path.join(root, f))
            if len(found) >= 50:
                break
        if len(found) >= 50:
            break

    if not found:
        return f"No files found matching '{query}'."

    # Sort by modification time — newest first
    found.sort(key=lambda p: os.path.getmtime(p), reverse=True)

    lines = []
    for p in found[:15]:
        mtime = datetime.fromtimestamp(os.path.getmtime(p)).strftime("%d %b %Y")
        lines.append(f"• {os.path.basename(p)}  ({mtime})  {p}")

    return f"Found {len(found)} file(s), newest first:\n" + "\n".join(lines)


@tool
def download_file(url: str, filename: str = "") -> str:
    """Download a file from a URL and save it to the Downloads folder.
    url: direct download link
    filename: optional custom filename — defaults to the name in the URL"""
    try:
        if not filename:
            filename = url.split("/")[-1].split("?")[0].strip()
            if not filename or "." not in filename:
                filename = f"download_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        save_path = Path.home() / "Downloads" / filename

        with httpx.stream("GET", url, follow_redirects=True, timeout=60) as resp:
            resp.raise_for_status()
            # Try to get real filename from Content-Disposition header
            cd = resp.headers.get("content-disposition", "")
            if 'filename="' in cd:
                fname = cd.split('filename="')[1].split('"')[0]
                if fname:
                    save_path = Path.home() / "Downloads" / fname
            with open(str(save_path), "wb") as f:
                for chunk in resp.iter_bytes(chunk_size=8192):
                    f.write(chunk)

        size = save_path.stat().st_size
        size_str = f"{size // 1024} KB" if size < 1024 * 1024 else f"{size / 1024**2:.1f} MB"
        return f"Downloaded '{save_path.name}' ({size_str}) to Downloads folder."
    except httpx.HTTPStatusError as e:
        return f"Download failed: server returned {e.response.status_code}."
    except Exception as e:
        return f"Download failed: {e}"


@tool
def set_volume(level: int) -> str:
    """Set the system master volume. level: 0 (mute) to 100 (max)."""
    level = max(0, min(100, int(level)))

    try:
        from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
        from ctypes import cast, POINTER
        from comtypes import CLSCTX_ALL  # type: ignore
        devices = AudioUtilities.GetSpeakers()
        interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
        vol_ctrl = cast(interface, POINTER(IAudioEndpointVolume))
        vol_ctrl.SetMasterVolumeLevelScalar(level / 100.0, None)
        return f"Volume set to {level}%."
    except ImportError:
        pass

    # PowerShell fallback (waveOut — works on most Windows 10/11 setups)
    ps = rf"""
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Vol {{
    [DllImport("winmm.dll")]
    public static extern int waveOutSetVolume(IntPtr h, uint vol);
}}
"@
`$v = [uint32]([math]::Round({level}/100.0*65535))
[Vol]::waveOutSetVolume([IntPtr]::Zero, `$v -bor (`$v -shl 16))
"""
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
            capture_output=True, timeout=12,
        )
        return f"Volume set to {level}%."
    except Exception as e:
        return f"Could not set volume: {e}"


@tool
def get_system_info() -> str:
    """Get current system stats: CPU usage, RAM usage, disk space, and uptime."""
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("C:\\")
        boot = datetime.fromtimestamp(psutil.boot_time())
        up = datetime.now() - boot
        h, rem = divmod(int(up.total_seconds()), 3600)
        m = rem // 60
        return (
            f"CPU: {cpu}%\n"
            f"RAM: {mem.percent}% used  ({mem.used // 1024**2} MB / {mem.total // 1024**2} MB)\n"
            f"Disk C: {disk.percent}% used  ({disk.free // 1024**3} GB free of {disk.total // 1024**3} GB)\n"
            f"Uptime: {h}h {m}m"
        )
    except ImportError:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Get-CimInstance Win32_OperatingSystem | Format-List FreePhysicalMemory,TotalVisibleMemorySize,LastBootUpTime"],
            capture_output=True, text=True, timeout=12,
        )
        return r.stdout.strip() or "Could not retrieve system info."


@tool
def lock_screen() -> str:
    """Lock the Windows screen / workstation immediately."""
    try:
        subprocess.Popen(["rundll32.exe", "user32.dll,LockWorkStation"])
        return "Screen locked."
    except Exception as e:
        return f"Could not lock screen: {e}"


@tool
def get_clipboard() -> str:
    """Get the current text content of the clipboard."""
    try:
        import pyperclip
        text = pyperclip.paste()
        return f"Clipboard: {text[:500]}{'...' if len(text) > 500 else ''}" if text else "Clipboard is empty."
    except ImportError:
        r = subprocess.run(["powershell", "-NoProfile", "-Command", "Get-Clipboard"],
                           capture_output=True, text=True, timeout=8)
        text = r.stdout.strip()
        return f"Clipboard: {text[:500]}" if text else "Clipboard is empty."
    except Exception as e:
        return f"Failed: {e}"


@tool
def set_clipboard(text: str) -> str:
    """Set the clipboard to the given text so the user can paste it anywhere."""
    try:
        import pyperclip
        pyperclip.copy(text)
        return f"Copied {len(text)} characters to clipboard."
    except ImportError:
        safe = text.replace("'", "''")
        subprocess.run(["powershell", "-NoProfile", "-Command", f"Set-Clipboard -Value '{safe}'"],
                       capture_output=True, timeout=8)
        return "Copied to clipboard."
    except Exception as e:
        return f"Failed: {e}"


@tool
def power_control(action: str) -> str:
    """Control system power state.
    action must be one of: shutdown, restart, sleep, hibernate, cancel.
    shutdown/restart have a 30-second delay — use cancel to abort."""
    action = action.lower().strip()
    cmds: dict[str, list[str]] = {
        "shutdown":  ["shutdown", "/s", "/t", "30", "/c", "EDITH: shutting down in 30s"],
        "restart":   ["shutdown", "/r", "/t", "30", "/c", "EDITH: restarting in 30s"],
        "sleep":     ["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"],
        "hibernate": ["shutdown", "/h"],
        "cancel":    ["shutdown", "/a"],
    }
    if action not in cmds:
        return f"Unknown action '{action}'. Use: shutdown, restart, sleep, hibernate, cancel."
    try:
        subprocess.Popen(cmds[action])
        msgs = {
            "shutdown":  "Shutting down in 30 seconds. Say 'cancel shutdown' to abort.",
            "restart":   "Restarting in 30 seconds. Say 'cancel shutdown' to abort.",
            "sleep":     "Going to sleep.",
            "hibernate": "Hibernating.",
            "cancel":    "Shutdown/restart cancelled.",
        }
        return msgs[action]
    except Exception as e:
        return f"Failed: {e}"


@tool
def set_brightness(level: int) -> str:
    """Set screen brightness. level: 0 (minimum) to 100 (maximum)."""
    level = max(0, min(100, int(level)))
    ps = f"""
$mon = Get-WmiObject -Namespace root/WMI -Class WmiMonitorBrightnessMethods -ErrorAction SilentlyContinue
if ($mon) {{ $mon.WmiSetBrightness(1, {level}); Write-Output "Brightness set to {level}%." }}
else {{ Write-Output "Brightness API not available on this display." }}
"""
    try:
        r = subprocess.run(["powershell", "-NoProfile", "-NonInteractive", "-Command", ps],
                           capture_output=True, text=True, timeout=10)
        return r.stdout.strip() or f"Brightness set to {level}%."
    except Exception as e:
        return f"Failed: {e}"


@tool
def create_file(path: str, content: str = "") -> str:
    """Create a new file with optional text content.
    path: absolute path or filename (defaults to Desktop).
    Examples: 'notes.txt', 'todo.md', 'C:/Users/Name/Documents/report.txt'"""
    from pathlib import Path
    p = Path(path) if Path(path).is_absolute() else Path.home() / "Desktop" / path
    try:
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return f"Created: {p}"
    except Exception as e:
        return f"Failed to create file: {e}"


@tool
def delete_file(path: str) -> str:
    """Delete a specific file (will NOT delete folders).
    path: absolute path or filename on Desktop."""
    from pathlib import Path
    p = Path(path) if Path(path).is_absolute() else Path.home() / "Desktop" / path
    if not p.exists():
        return f"File not found: {p}"
    if not p.is_file():
        return f"'{p}' is a directory — only files can be deleted this way."
    try:
        p.unlink()
        return f"Deleted: {p}"
    except Exception as e:
        return f"Failed: {e}"


@tool
def run_command(command: str) -> str:
    """Run a shell command and return its output. Use for scripts, build tools, git, etc.
    Examples: 'git status', 'npm run dev', 'python script.py', 'dir downloads'"""
    blocked = ["rm -rf /", "format c", "del /f /s /q c:\\", "rd /s /q c:\\"]
    if any(b in command.lower() for b in blocked):
        return "Blocked: potentially destructive command."
    try:
        r = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=30)
        out = (r.stdout + r.stderr).strip()
        return out[:1500] if out else f"Command exited with code {r.returncode}."
    except subprocess.TimeoutExpired:
        return "Command timed out after 30 seconds."
    except Exception as e:
        return f"Failed: {e}"


@tool
def notify(title: str, message: str) -> str:
    """Show a Windows desktop toast notification.
    title: notification heading. message: notification body text."""
    ps = f"""
Add-Type -AssemblyName System.Windows.Forms
$n = New-Object System.Windows.Forms.NotifyIcon
$n.Icon = [System.Drawing.SystemIcons]::Information
$n.BalloonTipIcon = 'Info'
$n.BalloonTipTitle = '{title.replace("'", "''")}'
$n.BalloonTipText = '{message.replace("'", "''")}'
$n.Visible = $True
$n.ShowBalloonTip(5000)
Start-Sleep -Seconds 6
$n.Dispose()
"""
    try:
        subprocess.Popen(["powershell", "-NoProfile", "-WindowStyle", "Hidden", "-Command", ps])
        return f"Notification sent: {title}"
    except Exception as e:
        return f"Failed: {e}"


@tool
def take_screenshot(filename: str = "") -> str:
    """Take a screenshot of the current screen and save it to the Desktop.
    filename: optional — defaults to screenshot_YYYYMMDD_HHMMSS.png"""
    fn = (filename.strip() or f"screenshot_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png")
    if not fn.endswith((".png", ".jpg", ".jpeg")):
        fn += ".png"
    save_path = Path.home() / "Desktop" / fn

    try:
        from PIL import ImageGrab  # type: ignore
        img = ImageGrab.grab()
        img.save(str(save_path))
        return f"Screenshot saved to Desktop: {fn}"
    except ImportError:
        pass

    # PowerShell fallback (no Pillow needed)
    ps_path = str(save_path).replace("\\", "/")
    ps = f"""
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $b.Width,$b.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size)
$bmp.Save('{ps_path}')
$g.Dispose(); $bmp.Dispose()
"""
    try:
        subprocess.run(["powershell", "-NoProfile", "-Command", ps],
                       capture_output=True, timeout=15)
        if save_path.exists():
            return f"Screenshot saved to Desktop: {fn}"
        return "Screenshot failed — Pillow not installed and PowerShell fallback also failed."
    except Exception as e:
        return f"Screenshot failed: {e}"

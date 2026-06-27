import subprocess
from langchain_core.tools import tool


def _ps(cmd: str, timeout: int = 10) -> str:
    r = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
        capture_output=True, text=True, timeout=timeout,
    )
    return r.stdout.strip()


@tool
def list_windows() -> str:
    """List all currently open visible windows with their titles."""
    try:
        import pygetwindow as gw
        titles = sorted(set(w.title for w in gw.getAllWindows() if w.title.strip()))
        return "Open windows:\n" + "\n".join(f"• {t}" for t in titles[:30])
    except ImportError:
        out = _ps("Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object -ExpandProperty MainWindowTitle | Sort-Object -Unique")
        lines = [l for l in out.splitlines() if l.strip()]
        return "Open windows:\n" + "\n".join(f"• {l}" for l in lines[:30])
    except Exception as e:
        return f"Failed: {e}"


@tool
def focus_window(app_name: str) -> str:
    """Bring a window to the front and give it focus.
    Examples: 'chrome', 'notepad', 'vs code', 'discord', 'spotify'"""
    try:
        import pygetwindow as gw
        wins = [w for w in gw.getAllWindows() if app_name.lower() in w.title.lower() and w.title.strip()]
        if not wins:
            return f"No window found matching '{app_name}'."
        w = wins[0]
        if w.isMinimized:
            w.restore()
        w.activate()
        return f"Focused: {w.title}"
    except ImportError:
        out = _ps(f"""
Add-Type @'
using System; using System.Runtime.InteropServices;
public class W {{
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
}}
'@
$p = Get-Process | Where-Object {{$_.MainWindowTitle -like '*{app_name}*'}} | Select-Object -First 1
if ($p) {{ [W]::ShowWindow($p.MainWindowHandle, 9); [W]::SetForegroundWindow($p.MainWindowHandle); "Focused: $($p.MainWindowTitle)" }}
else {{ "No window found matching '{app_name}'." }}
""")
        return out or f"Focused {app_name}."
    except Exception as e:
        return f"Failed: {e}"


@tool
def minimize_window(app_name: str) -> str:
    """Minimize a window by app name. Examples: 'chrome', 'spotify', 'discord'"""
    try:
        import pygetwindow as gw
        wins = [w for w in gw.getAllWindows() if app_name.lower() in w.title.lower() and w.title.strip()]
        if not wins:
            return f"No window found matching '{app_name}'."
        wins[0].minimize()
        return f"Minimized: {wins[0].title}"
    except ImportError:
        out = _ps(f"""
Add-Type @'
using System; using System.Runtime.InteropServices;
public class W {{ [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n); }}
'@
$p = Get-Process | Where-Object {{$_.MainWindowTitle -like '*{app_name}*'}} | Select-Object -First 1
if ($p) {{ [W]::ShowWindow($p.MainWindowHandle, 2); "Minimized." }} else {{ "Not found." }}
""")
        return out or f"Minimized {app_name}."
    except Exception as e:
        return f"Failed: {e}"


@tool
def maximize_window(app_name: str) -> str:
    """Maximize a window by app name. Examples: 'chrome', 'notepad', 'vs code'"""
    try:
        import pygetwindow as gw
        wins = [w for w in gw.getAllWindows() if app_name.lower() in w.title.lower() and w.title.strip()]
        if not wins:
            return f"No window found matching '{app_name}'."
        wins[0].maximize()
        return f"Maximized: {wins[0].title}"
    except ImportError:
        out = _ps(f"""
Add-Type @'
using System; using System.Runtime.InteropServices;
public class W {{ [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n); }}
'@
$p = Get-Process | Where-Object {{$_.MainWindowTitle -like '*{app_name}*'}} | Select-Object -First 1
if ($p) {{ [W]::ShowWindow($p.MainWindowHandle, 3); "Maximized." }} else {{ "Not found." }}
""")
        return out or f"Maximized {app_name}."
    except Exception as e:
        return f"Failed: {e}"


@tool
def get_active_window() -> str:
    """Get the title of the currently focused/active window."""
    try:
        import pygetwindow as gw
        w = gw.getActiveWindow()
        return f"Active window: {w.title}" if w and w.title else "No active window."
    except ImportError:
        title = _ps("""
Add-Type @'
using System.Runtime.InteropServices; using System.Text;
public class W {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
}
'@
$h = [W]::GetForegroundWindow()
$sb = New-Object System.Text.StringBuilder 256
[W]::GetWindowText($h, $sb, 256) | Out-Null
$sb.ToString()
""")
        return f"Active window: {title}" if title else "No active window."
    except Exception as e:
        return f"Failed: {e}"


@tool
def click_at(x: int, y: int, button: str = "left") -> str:
    """Click the mouse at screen coordinates (x, y).
    button: 'left' (default), 'right', or 'double'"""
    try:
        import pyautogui
        import time
        pyautogui.FAILSAFE = False
        time.sleep(0.1)
        if button == "double":
            pyautogui.doubleClick(x, y)
        elif button == "right":
            pyautogui.rightClick(x, y)
        else:
            pyautogui.click(x, y)
        return f"Clicked {button} at ({x}, {y})."
    except ImportError:
        _ps(f"""
Add-Type @'
using System; using System.Runtime.InteropServices;
public class M {{
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int c, int e);
}}
'@
[M]::SetCursorPos({x}, {y})
Start-Sleep -Milliseconds 80
[M]::mouse_event(0x0002, 0, 0, 0, 0)
[M]::mouse_event(0x0004, 0, 0, 0, 0)
""")
        return f"Clicked at ({x}, {y})."
    except Exception as e:
        return f"Failed: {e}"


@tool
def type_text(text: str) -> str:
    """Type text at the current cursor position (simulates keyboard input).
    Make sure the target window is focused first with focus_window."""
    try:
        import pyautogui
        import time
        pyautogui.FAILSAFE = False
        time.sleep(0.15)
        pyautogui.write(text, interval=0.025)
        return f"Typed {len(text)} characters."
    except ImportError:
        safe = text.replace("'", "''")
        _ps(f"Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{safe}')")
        return "Typed text."
    except Exception as e:
        return f"Failed: {e}"


@tool
def send_hotkey(keys: str) -> str:
    """Send a keyboard shortcut to the active window.
    Examples: 'ctrl+c', 'ctrl+v', 'ctrl+z', 'alt+tab', 'win+d', 'ctrl+shift+t', 'ctrl+alt+del'"""
    try:
        import pyautogui
        import time
        pyautogui.FAILSAFE = False
        time.sleep(0.1)
        parts = [k.strip() for k in keys.lower().split('+')]
        pyautogui.hotkey(*parts)
        return f"Sent: {keys}"
    except ImportError:
        wsh_map = {'ctrl': '^', 'alt': '%', 'shift': '+', 'enter': '~', 'tab': '{TAB}', 'esc': '{ESC}', 'win': '^{ESC}'}
        parts = [k.strip() for k in keys.lower().split('+')]
        sk = ''.join(wsh_map.get(p, p.upper()) for p in parts)
        _ps(f"$wsh=New-Object -ComObject wscript.shell; $wsh.SendKeys('{sk}')")
        return f"Sent: {keys}"
    except Exception as e:
        return f"Failed: {e}"


@tool
def move_resize_window(app_name: str, x: int, y: int, width: int, height: int) -> str:
    """Move and resize a window. x,y = top-left screen position in pixels. width,height in pixels.
    Example: move_resize_window('chrome', 0, 0, 960, 1080) snaps Chrome to left half."""
    try:
        import pygetwindow as gw
        wins = [w for w in gw.getAllWindows() if app_name.lower() in w.title.lower() and w.title.strip()]
        if not wins:
            return f"No window found matching '{app_name}'."
        w = wins[0]
        if w.isMinimized:
            w.restore()
        w.moveTo(x, y)
        w.resizeTo(width, height)
        return f"Moved '{w.title}' to ({x},{y}), size {width}×{height}."
    except ImportError:
        out = _ps(f"""
Add-Type @'
using System; using System.Runtime.InteropServices;
public class W {{ [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int h2, bool r); }}
'@
$p = Get-Process | Where-Object {{$_.MainWindowTitle -like '*{app_name}*'}} | Select-Object -First 1
if ($p) {{ [W]::MoveWindow($p.MainWindowHandle, {x}, {y}, {width}, {height}, $true); "Moved." }} else {{ "Not found." }}
""")
        return out or f"Moved {app_name}."
    except Exception as e:
        return f"Failed: {e}"

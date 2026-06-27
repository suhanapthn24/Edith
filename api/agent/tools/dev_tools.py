"""
Developer tools: Docker, open ports, git shortcuts, HTTP requests, environment info.
"""

import json
import subprocess
from pathlib import Path

from langchain_core.tools import tool


def _run(cmd: list[str] | str, timeout: int = 20, shell: bool = False) -> tuple[str, int]:
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, shell=shell)
    return (r.stdout + r.stderr).strip(), r.returncode


def _ps(cmd: str, timeout: int = 12) -> str:
    r = subprocess.run(
        ["powershell", "-NoProfile", "-NonInteractive", "-Command", cmd],
        capture_output=True, text=True, timeout=timeout,
    )
    return r.stdout.strip()


# ── Docker ────────────────────────────────────────────────────────────────────

def _docker_available() -> bool:
    out, code = _run(["docker", "info"], timeout=5)
    return code == 0


@tool
def docker_list() -> str:
    """List all Docker containers (running and stopped) with their status."""
    if not _docker_available():
        return "Docker is not running or not installed."
    out, _ = _run(["docker", "ps", "-a",
                   "--format", "table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}"])
    return out or "No containers found."


@tool
def docker_start(name: str) -> str:
    """Start a stopped Docker container by name or ID."""
    if not _docker_available():
        return "Docker is not running."
    out, code = _run(["docker", "start", name])
    return f"Started '{name}'." if code == 0 else out


@tool
def docker_stop(name: str) -> str:
    """Stop a running Docker container by name or ID."""
    if not _docker_available():
        return "Docker is not running."
    out, code = _run(["docker", "stop", name])
    return f"Stopped '{name}'." if code == 0 else out


@tool
def docker_restart(name: str) -> str:
    """Restart a Docker container by name or ID."""
    if not _docker_available():
        return "Docker is not running."
    out, code = _run(["docker", "restart", name])
    return f"Restarted '{name}'." if code == 0 else out


@tool
def docker_logs(name: str, lines: int = 50) -> str:
    """Get the last N log lines from a Docker container.
    name: container name or ID. lines: how many tail lines (default 50)."""
    if not _docker_available():
        return "Docker is not running."
    out, code = _run(["docker", "logs", "--tail", str(lines), name])
    return out[:3000] if out else f"No logs for '{name}'."


@tool
def docker_images() -> str:
    """List all locally available Docker images."""
    if not _docker_available():
        return "Docker is not running."
    out, _ = _run(["docker", "images",
                   "--format", "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"])
    return out or "No images found."


@tool
def docker_compose(action: str, path: str = ".") -> str:
    """Run docker-compose commands.
    action: 'up', 'down', 'restart', 'ps', 'logs'.
    path: directory containing docker-compose.yml (default: current directory)."""
    if action not in ("up", "down", "restart", "ps", "logs"):
        return "action must be: up, down, restart, ps, or logs"
    cmd_map = {
        "up":      ["docker", "compose", "up", "-d"],
        "down":    ["docker", "compose", "down"],
        "restart": ["docker", "compose", "restart"],
        "ps":      ["docker", "compose", "ps"],
        "logs":    ["docker", "compose", "logs", "--tail=40"],
    }
    try:
        r = subprocess.run(cmd_map[action], capture_output=True, text=True,
                           cwd=path, timeout=60)
        out = (r.stdout + r.stderr).strip()
        return out[:2000] if out else f"docker compose {action}: done."
    except FileNotFoundError:
        return "docker compose not found."
    except subprocess.TimeoutExpired:
        return f"docker compose {action} timed out."
    except Exception as e:
        return f"Failed: {e}"


# ── Network / Ports ───────────────────────────────────────────────────────────

@tool
def list_open_ports() -> str:
    """List all ports currently listening on this machine, with the process using each."""
    try:
        import psutil
        connections = psutil.net_connections(kind="inet")
        listening = [c for c in connections if c.status == "LISTEN"]
        lines = []
        for c in sorted(listening, key=lambda x: x.laddr.port):
            port = c.laddr.port
            addr = c.laddr.ip or "*"
            try:
                pname = psutil.Process(c.pid).name() if c.pid else "—"
            except Exception:
                pname = f"PID {c.pid}"
            lines.append(f"• :{port}  ({addr})  →  {pname}")
        return "Listening ports:\n" + "\n".join(lines[:40]) if lines else "No listening ports found."
    except ImportError:
        out = _ps("netstat -ano | Select-String 'LISTENING' | ForEach-Object { $_.Line.Trim() } | Select-Object -First 30")
        return "Listening ports:\n" + out if out else "Could not list ports."
    except Exception as e:
        return f"Failed: {e}"


@tool
def check_port(port: int) -> str:
    """Check what process is using a specific port, and whether it's open.
    port: the port number to check."""
    try:
        import psutil
        for c in psutil.net_connections(kind="inet"):
            if c.laddr.port == port:
                status = c.status
                try:
                    pname = psutil.Process(c.pid).name() if c.pid else "unknown"
                except Exception:
                    pname = f"PID {c.pid}"
                return f"Port {port}: {status} — used by {pname} (PID {c.pid})"
        return f"Port {port} is not in use."
    except ImportError:
        out = _ps(f"netstat -ano | Select-String ':{port}\\s' | Select-Object -First 3")
        return out or f"Port {port} not found in netstat."
    except Exception as e:
        return f"Failed: {e}"


@tool
def ping_host(host: str, count: int = 4) -> str:
    """Ping a hostname or IP address to check connectivity and latency.
    host: domain or IP (e.g. 'google.com', '8.8.8.8').
    count: number of ping packets (default 4)."""
    try:
        out, code = _run(["ping", "-n", str(count), host], timeout=15)
        return out[:1000]
    except subprocess.TimeoutExpired:
        return f"Ping to {host} timed out."
    except Exception as e:
        return f"Failed: {e}"


# ── Git ───────────────────────────────────────────────────────────────────────

def _git(args: list[str], cwd: str | None = None, timeout: int = 15) -> str:
    try:
        r = subprocess.run(["git"] + args, capture_output=True, text=True,
                           cwd=cwd, timeout=timeout)
        return (r.stdout + r.stderr).strip()
    except FileNotFoundError:
        return "git not found. Make sure Git is installed."
    except subprocess.TimeoutExpired:
        return "git command timed out."


@tool
def git_status(path: str = ".") -> str:
    """Get git status for a repository.
    path: repository directory (default: current working directory)."""
    return _git(["status", "--short", "--branch"], cwd=path) or "Clean working tree."


@tool
def git_log(path: str = ".", count: int = 10) -> str:
    """Show recent git commits for a repository.
    path: repo directory. count: number of commits to show (default 10)."""
    return _git(["log", f"--max-count={count}", "--oneline", "--graph",
                 "--decorate"], cwd=path)


@tool
def git_diff(path: str = ".") -> str:
    """Show unstaged changes in a git repository.
    path: repo directory."""
    out = _git(["diff", "--stat"], cwd=path)
    if not out:
        return "No unstaged changes."
    detail = _git(["diff", "--unified=2"], cwd=path)
    return (detail[:2500] if detail else out)


@tool
def git_pull(path: str = ".") -> str:
    """Pull latest changes from the remote for the current branch.
    path: repo directory."""
    return _git(["pull"], cwd=path, timeout=30)


@tool
def git_commit(message: str, path: str = ".") -> str:
    """Stage all changes and create a git commit.
    message: commit message. path: repo directory."""
    _git(["add", "-A"], cwd=path)
    return _git(["commit", "-m", message], cwd=path)


@tool
def git_branches(path: str = ".") -> str:
    """List all git branches in a repository.
    path: repo directory."""
    return _git(["branch", "-a", "--sort=-committerdate"], cwd=path)


# ── HTTP Requests ─────────────────────────────────────────────────────────────

@tool
def http_get(url: str, headers: str = "") -> str:
    """Make an HTTP GET request and return the response.
    url: the endpoint to call.
    headers: optional JSON string of headers e.g. '{\"Authorization\": \"Bearer token\"}'"""
    try:
        import httpx
        hdrs = json.loads(headers) if headers.strip() else {}
        r = httpx.get(url, headers=hdrs, timeout=15, follow_redirects=True)
        body = r.text[:2000]
        return f"Status: {r.status_code}\n{body}"
    except ImportError:
        return "httpx not installed."
    except Exception as e:
        return f"Request failed: {e}"


@tool
def http_post(url: str, body: str, headers: str = "") -> str:
    """Make an HTTP POST request with a JSON body and return the response.
    url: the endpoint. body: JSON string payload. headers: optional JSON headers."""
    try:
        import httpx
        hdrs = {"Content-Type": "application/json"}
        if headers.strip():
            hdrs.update(json.loads(headers))
        payload = json.loads(body)
        r = httpx.post(url, json=payload, headers=hdrs, timeout=15)
        return f"Status: {r.status_code}\n{r.text[:2000]}"
    except ImportError:
        return "httpx not installed."
    except Exception as e:
        return f"Request failed: {e}"


# ── Environment ───────────────────────────────────────────────────────────────

@tool
def get_env_info() -> str:
    """Get development environment info: Python version, Node, npm, git, docker versions."""
    checks = {
        "Python":  ["python", "--version"],
        "Node.js": ["node", "--version"],
        "npm":     ["npm", "--version"],
        "Git":     ["git", "--version"],
        "Docker":  ["docker", "--version"],
        "pip":     ["pip", "--version"],
    }
    results = []
    for name, cmd in checks.items():
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            ver = (r.stdout + r.stderr).strip().splitlines()[0]
            results.append(f"• {name}: {ver}")
        except (FileNotFoundError, subprocess.TimeoutExpired):
            results.append(f"• {name}: not found")
    return "Environment:\n" + "\n".join(results)

"""
Home Assistant smart home integration.
Add to api/.env:
  HA_URL=http://homeassistant.local:8123
  HA_TOKEN=<your Long-Lived Access Token from HA Profile page>
"""

import os
from typing import Optional

import httpx
from langchain_core.tools import tool


def _base() -> str:
    return os.getenv("HA_URL", "http://homeassistant.local:8123").rstrip("/")


def _headers() -> dict:
    token = os.getenv("HA_TOKEN", "")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _not_configured() -> Optional[str]:
    if not os.getenv("HA_TOKEN"):
        return "Home Assistant not configured. Add HA_URL and HA_TOKEN to api/.env."
    return None


# ── Device listing ────────────────────────────────────────────────────────────

@tool
async def get_home_devices(domain: str = "") -> str:
    """List smart home devices and their current states.
    domain: filter by type, e.g. 'light', 'switch', 'climate', 'sensor'. Empty = all."""
    err = _not_configured()
    if err:
        return err
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(f"{_base()}/api/states", headers=_headers())
        if r.status_code != 200:
            return f"Home Assistant returned {r.status_code}: {r.text[:200]}"
        states = r.json()
        if domain:
            states = [s for s in states if s.get("entity_id", "").startswith(f"{domain}.")]
        if not states:
            return f"No devices found{f' for domain {domain}' if domain else ''}."
        lines = []
        for s in states[:30]:
            entity = s.get("entity_id", "")
            state = s.get("state", "")
            name = s.get("attributes", {}).get("friendly_name", entity)
            lines.append(f"• {name} [{entity}]: {state}")
        if len(states) > 30:
            lines.append(f"... and {len(states)-30} more. Use domain filter to narrow results.")
        return "\n".join(lines)
    except Exception as e:
        return f"Smart home error: {e}"


@tool
async def get_home_state(entity_id: str) -> str:
    """Get the current state and attributes of a specific Home Assistant entity.
    entity_id: e.g. 'light.living_room', 'climate.bedroom', 'sensor.temperature'"""
    err = _not_configured()
    if err:
        return err
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(f"{_base()}/api/states/{entity_id}", headers=_headers())
        if r.status_code == 404:
            return f"Entity '{entity_id}' not found."
        if r.status_code != 200:
            return f"Error {r.status_code}: {r.text[:200]}"
        d = r.json()
        state = d.get("state", "")
        attrs = d.get("attributes", {})
        name = attrs.get("friendly_name", entity_id)
        lines = [f"{name}: {state}"]
        for k, v in list(attrs.items())[:8]:
            if k != "friendly_name":
                lines.append(f"  {k}: {v}")
        return "\n".join(lines)
    except Exception as e:
        return f"Smart home error: {e}"


# ── Device control ────────────────────────────────────────────────────────────

@tool
async def control_device(entity_id: str, action: str) -> str:
    """Turn a smart home device on, off, or toggle it.
    entity_id: e.g. 'light.living_room', 'switch.fan', 'media_player.tv'
    action: 'on', 'off', or 'toggle'"""
    err = _not_configured()
    if err:
        return err
    action = action.lower().strip()
    service_map = {"on": "turn_on", "off": "turn_off", "toggle": "toggle"}
    service = service_map.get(action)
    if not service:
        return f"Unknown action '{action}'. Use: on, off, toggle."
    domain = entity_id.split(".")[0]
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.post(
                f"{_base()}/api/services/{domain}/{service}",
                headers=_headers(),
                json={"entity_id": entity_id},
            )
        if r.status_code in (200, 201):
            name = entity_id.split(".", 1)[-1].replace("_", " ").title()
            return f"{name} turned {action}."
        return f"Error {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return f"Smart home error: {e}"


@tool
async def set_light_brightness(entity_id: str, brightness_pct: int) -> str:
    """Set a light's brightness.
    entity_id: e.g. 'light.bedroom'. brightness_pct: 0–100."""
    err = _not_configured()
    if err:
        return err
    brightness = max(0, min(255, int(brightness_pct * 2.55)))
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.post(
                f"{_base()}/api/services/light/turn_on",
                headers=_headers(),
                json={"entity_id": entity_id, "brightness": brightness},
            )
        if r.status_code in (200, 201):
            return f"Light brightness set to {brightness_pct}%."
        return f"Error {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return f"Smart home error: {e}"


@tool
async def set_thermostat(entity_id: str, temperature: float, mode: str = "") -> str:
    """Set thermostat target temperature and optionally HVAC mode.
    entity_id: e.g. 'climate.living_room'. temperature: degrees Celsius.
    mode: 'heat', 'cool', 'auto', 'off' (optional)."""
    err = _not_configured()
    if err:
        return err
    try:
        payload: dict = {"entity_id": entity_id, "temperature": temperature}
        async with httpx.AsyncClient(timeout=6.0) as client:
            if mode:
                await client.post(
                    f"{_base()}/api/services/climate/set_hvac_mode",
                    headers=_headers(),
                    json={"entity_id": entity_id, "hvac_mode": mode},
                )
            r = await client.post(
                f"{_base()}/api/services/climate/set_temperature",
                headers=_headers(),
                json=payload,
            )
        if r.status_code in (200, 201):
            return f"Thermostat set to {temperature}°C{f', mode: {mode}' if mode else ''}."
        return f"Error {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return f"Smart home error: {e}"


@tool
async def run_home_automation(automation_id: str) -> str:
    """Trigger a Home Assistant automation.
    automation_id: e.g. 'automation.good_morning_routine'"""
    err = _not_configured()
    if err:
        return err
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.post(
                f"{_base()}/api/services/automation/trigger",
                headers=_headers(),
                json={"entity_id": automation_id},
            )
        if r.status_code in (200, 201):
            return f"Automation '{automation_id}' triggered."
        return f"Error {r.status_code}: {r.text[:200]}"
    except Exception as e:
        return f"Smart home error: {e}"

import httpx
from langchain_core.tools import tool
from config import settings

OWM_BASE = "https://api.openweathermap.org/data/2.5"


def _params(location: str) -> dict:
    parts = location.split(",")
    if len(parts) == 2:
        try:
            lat, lon = float(parts[0].strip()), float(parts[1].strip())
            return {"lat": lat, "lon": lon, "appid": settings.WEATHER_API_KEY, "units": "metric"}
        except ValueError:
            pass
    return {"q": location, "appid": settings.WEATHER_API_KEY, "units": "metric"}


@tool
def get_weather(location: str) -> str:
    """Get the current weather for a city or location (e.g. 'London', 'New York', 'Mumbai')."""
    try:
        r = httpx.get(f"{OWM_BASE}/weather", params=_params(location), timeout=8)
        r.raise_for_status()
        d = r.json()

        name = d.get("name", location)
        country = d.get("sys", {}).get("country", "")
        desc = d["weather"][0]["description"].capitalize()
        temp = d["main"]["temp"]
        feels = d["main"]["feels_like"]
        humidity = d["main"]["humidity"]
        wind = d.get("wind", {}).get("speed", 0)

        return (
            f"Weather in {name}, {country}: {desc}. "
            f"{temp:.0f}°C (feels like {feels:.0f}°C), "
            f"humidity {humidity}%, wind {wind} m/s."
        )
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return f"Location '{location}' not found. Try a city name like 'London' or 'Mumbai'."
        return f"Weather fetch failed: {e}"
    except Exception as e:
        return f"Weather fetch failed: {e}"


@tool
def get_forecast(location: str, days: int = 3) -> str:
    """Get a weather forecast for the next 1–5 days for a city or location."""
    days = max(1, min(days, 5))
    try:
        r = httpx.get(f"{OWM_BASE}/forecast", params={**_params(location), "cnt": days * 8}, timeout=8)
        r.raise_for_status()
        d = r.json()

        name = d.get("city", {}).get("name", location)
        country = d.get("city", {}).get("country", "")

        # Pick one entry per day (noon-ish)
        seen_dates: set[str] = set()
        lines = []
        for item in d.get("list", []):
            date = item["dt_txt"][:10]
            time = item["dt_txt"][11:13]
            if date in seen_dates:
                continue
            if time not in ("12", "11", "13", "09") and len(seen_dates) < days - 1:
                continue
            seen_dates.add(date)
            desc = item["weather"][0]["description"].capitalize()
            temp_min = item["main"]["temp_min"]
            temp_max = item["main"]["temp_max"]
            lines.append(f"• {date}: {desc}, {temp_min:.0f}–{temp_max:.0f}°C")
            if len(seen_dates) >= days:
                break

        return f"Forecast for {name}, {country}:\n" + "\n".join(lines)
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            return f"Location '{location}' not found."
        return f"Forecast fetch failed: {e}"
    except Exception as e:
        return f"Forecast fetch failed: {e}"

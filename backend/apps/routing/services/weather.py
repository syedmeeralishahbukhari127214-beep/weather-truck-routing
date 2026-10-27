"""Open-Meteo client: batched hourly forecasts, sampled at each checkpoint's ETA.

Units are requested directly in mph / inches so no conversion is needed.
`rain` and `showers` are summed into one rain figure (in/hr, since values are hourly).
"""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Dict, Iterable, List, Optional, Tuple

import requests
from django.core.cache import cache

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
HOURLY_VARS = "wind_speed_10m,rain,showers,snowfall"
CHUNK_SIZE = 50          # locations per request (keeps URLs short)
MAX_WORKERS = 4
CACHE_TTL_SECONDS = 30 * 60
TIMEOUT_SECONDS = 20

Key = Tuple[float, float]


class WeatherError(Exception):
    """Raised for any weather-provider failure or missing forecast."""


@dataclass(frozen=True)
class HourlyForecast:
    times: Tuple[datetime, ...]  # UTC, contiguous hourly
    wind_mph: Tuple[Optional[float], ...]
    rain_in: Tuple[Optional[float], ...]
    snow_in: Tuple[Optional[float], ...]


@dataclass(frozen=True)
class WeatherSample:
    wind_mph: float
    rain_in_hr: float
    snow_in_hr: float
    hour: datetime


def point_key(lat: float, lon: float) -> Key:
    """Round to ~0.7 mi so nearby checkpoints (and repeat searches) share a forecast."""
    return (round(lat, 2), round(lon, 2))


# ---------- parsing (pure) ----------

def _add(rain: Optional[float], showers: Optional[float]) -> Optional[float]:
    if rain is None and showers is None:
        return None
    return (rain or 0.0) + (showers or 0.0)


def parse_forecasts(payload) -> List[HourlyForecast]:
    """Open-Meteo returns a dict for one location and a list for several."""
    items = payload if isinstance(payload, list) else [payload]
    out = []
    for item in items:
        hourly = item.get("hourly")
        if not hourly:
            raise WeatherError("Weather provider returned no hourly data")
        times = tuple(
            datetime.fromisoformat(t).replace(tzinfo=timezone.utc) for t in hourly["time"]
        )
        rain = tuple(_add(r, s) for r, s in zip(hourly["rain"], hourly["showers"]))
        out.append(
            HourlyForecast(
                times=times,
                wind_mph=tuple(hourly["wind_speed_10m"]),
                rain_in=rain,
                snow_in=tuple(hourly["snowfall"]),
            )
        )
    return out


def sample_at(forecast: HourlyForecast, eta: datetime) -> WeatherSample:
    """Weather for the hour nearest to `eta`."""
    eta_utc = eta.astimezone(timezone.utc)
    idx = round((eta_utc - forecast.times[0]).total_seconds() / 3600)
    if not 0 <= idx < len(forecast.times):
        raise WeatherError(f"No forecast available for {eta_utc:%Y-%m-%d %H:%M} UTC")
    wind, rain, snow = forecast.wind_mph[idx], forecast.rain_in[idx], forecast.snow_in[idx]
    if wind is None or rain is None or snow is None:
        raise WeatherError(f"Forecast data missing for {eta_utc:%Y-%m-%d %H:%M} UTC")
    return WeatherSample(wind, rain, snow, forecast.times[idx])


# ---------- network ----------

def _request(params: dict):
    try:
        resp = requests.get(FORECAST_URL, params=params, timeout=TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        raise WeatherError(f"Could not reach weather service: {exc}") from exc
    if resp.status_code == 429:
        raise WeatherError("Weather service rate limit reached, try again shortly")
    data = resp.json() if resp.content else {}
    if not resp.ok:
        reason = data.get("reason") if isinstance(data, dict) else None
        raise WeatherError(reason or f"Weather service error {resp.status_code}")
    return data


def _fetch_chunk(keys: List[Key], start, end) -> List[HourlyForecast]:
    payload = _request(
        {
            "latitude": ",".join(str(k[0]) for k in keys),
            "longitude": ",".join(str(k[1]) for k in keys),
            "hourly": HOURLY_VARS,
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",
            "timezone": "UTC",
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
        }
    )
    forecasts = parse_forecasts(payload)
    if len(forecasts) != len(keys):
        raise WeatherError("Weather service returned an unexpected number of locations")
    return forecasts


def fetch_forecasts(
    points: Iterable[Key], first_eta: datetime, last_eta: datetime
) -> Dict[Key, HourlyForecast]:
    """One batched, cached, parallel fetch for every distinct point."""
    start = first_eta.astimezone(timezone.utc).date()
    end = last_eta.astimezone(timezone.utc).date()
    keys = sorted({point_key(lat, lon) for lat, lon in points})

    def ck(k: Key) -> str:
        return f"wx:{k[0]}:{k[1]}:{start}:{end}"

    result: Dict[Key, HourlyForecast] = {}
    missing = []
    for k in keys:
        hit = cache.get(ck(k))
        if hit is not None:
            result[k] = hit
        else:
            missing.append(k)

    chunks = [missing[i : i + CHUNK_SIZE] for i in range(0, len(missing), CHUNK_SIZE)]
    if chunks:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
            fetched = list(pool.map(lambda c: _fetch_chunk(c, start, end), chunks))
        for chunk, forecasts in zip(chunks, fetched):
            for k, fc in zip(chunk, forecasts):
                result[k] = fc
                cache.set(ck(k), fc, CACHE_TTL_SECONDS)
    return result

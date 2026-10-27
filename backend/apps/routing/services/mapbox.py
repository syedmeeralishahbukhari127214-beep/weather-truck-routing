"""Mapbox client: geocoding + driving routes with alternatives."""
from typing import List

import requests
from django.conf import settings
from django.core.cache import cache

from ..models import Place, Route

DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving/{coords}"
GEOCODE_URL = "https://api.mapbox.com/search/geocode/v6/forward"
GEOCODE_COUNTRIES = "us,ca,mx"
METERS_PER_MILE = 1609.344
TIMEOUT_SECONDS = 15
MAX_ROUTES = 3
ROUTES_CACHE_TTL_SECONDS = 10 * 60


class MapboxError(Exception):
    """Raised for any Mapbox failure; the view turns it into a clean HTTP error."""


def _token() -> str:
    token = settings.MAPBOX_TOKEN
    if not token:
        raise MapboxError("MAPBOX_TOKEN is not configured on the server")
    return token


def _get(url: str, params: dict) -> dict:
    try:
        resp = requests.get(url, params={**params, "access_token": _token()}, timeout=TIMEOUT_SECONDS)
    except requests.RequestException as exc:
        raise MapboxError(f"Could not reach Mapbox: {exc}") from exc
    if resp.status_code == 401:
        raise MapboxError("Mapbox rejected the access token")
    if resp.status_code == 429:
        raise MapboxError("Mapbox rate limit reached, try again shortly")
    if not resp.ok:
        raise MapboxError(f"Mapbox error {resp.status_code}")
    return resp.json()


# ---------- parsing (pure, unit-tested) ----------

def parse_routes(payload: dict) -> List[Route]:
    if payload.get("code") != "Ok" or not payload.get("routes"):
        raise MapboxError(payload.get("message") or "No route found between these locations")
    routes = []
    for i, r in enumerate(payload["routes"][:MAX_ROUTES]):
        legs = r.get("legs", [])
        summary = " → ".join(l["summary"] for l in legs if l.get("summary")) or f"Route {i + 1}"
        routes.append(
            Route(
                id=f"route-{i + 1}",
                summary=summary,
                distance_miles=r["distance"] / METERS_PER_MILE,
                duration_seconds=r["duration"],
                geometry=[tuple(c) for c in r["geometry"]["coordinates"]],
            )
        )
    return routes


def parse_places(payload: dict) -> List[Place]:
    places = []
    for f in payload.get("features", []):
        props = f.get("properties", {})
        label = props.get("full_address") or ", ".join(
            p for p in (props.get("name"), props.get("place_formatted")) if p
        )
        lon, lat = f["geometry"]["coordinates"]
        places.append(Place(label=label, lat=lat, lon=lon))
    return places


# ---------- public API ----------

def get_routes(origin: Place, destination: Place) -> List[Route]:
    """Cached for a few minutes: /routes and /heatmap are called back-to-back."""
    coords = f"{origin.lon:.4f},{origin.lat:.4f};{destination.lon:.4f},{destination.lat:.4f}"
    cache_key = f"routes:{coords}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    payload = _get(
        DIRECTIONS_URL.format(coords=coords),
        {"alternatives": "true", "geometries": "geojson", "overview": "full"},
    )
    routes = parse_routes(payload)
    cache.set(cache_key, routes, ROUTES_CACHE_TTL_SECONDS)
    return routes


def geocode(query: str, limit: int = 5) -> List[Place]:
    payload = _get(GEOCODE_URL, {"q": query, "limit": limit, "country": GEOCODE_COUNTRIES})
    return parse_places(payload)

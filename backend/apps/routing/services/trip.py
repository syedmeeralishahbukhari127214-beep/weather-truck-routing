"""Orchestrates one trip request: routes -> checkpoints -> weather -> risk -> recommendation."""
from datetime import datetime
from typing import Dict, List

from ..models import Place
from . import mapbox, weather
from .checkpoints import sample_checkpoints
from .recommender import rank_routes, summarize
from .risk import assess_checkpoint


def plan_trip(
    origin: Place, destination: Place, departure: datetime, load_lb: int, interval_miles: int
) -> dict:
    routes = mapbox.get_routes(origin, destination)
    sampled = {
        r.id: sample_checkpoints(r.geometry, interval_miles, departure, r.duration_seconds)
        for r in routes
    }

    all_cps = [c for cps in sampled.values() for c in cps]
    etas = [c.eta for c in all_cps]
    forecasts = weather.fetch_forecasts(
        [(c.lat, c.lon) for c in all_cps], min(etas), max(etas)
    )

    route_payloads: List[dict] = []
    stats_by_id: Dict[str, object] = {}
    for r in routes:
        cp_payloads, segments = [], []
        for c in sampled[r.id]:
            wx = weather.sample_at(forecasts[weather.point_key(c.lat, c.lon)], c.eta)
            risk = assess_checkpoint(wx.wind_mph, wx.rain_in_hr, wx.snow_in_hr, load_lb)
            segments.append((c.miles_represented, risk.overall))
            cp_payloads.append(
                {
                    "index": c.index,
                    "mile_marker": c.mile_marker,
                    "lat": c.lat,
                    "lon": c.lon,
                    "eta": c.eta.isoformat(),
                    "miles_represented": c.miles_represented,
                    "weather": {
                        "wind_mph": round(wx.wind_mph, 1),
                        "rain_in_hr": round(wx.rain_in_hr, 3),
                        "snow_in_hr": round(wx.snow_in_hr, 2),
                    },
                    "risk": {
                        "level": risk.overall.name,
                        "label": risk.overall.label,
                        "wind": risk.wind.name,
                        "rain": risk.rain.name,
                        "snow": risk.snow.name,
                    },
                }
            )
        stats = summarize(segments, r.distance_miles, r.duration_seconds)
        stats_by_id[r.id] = stats
        route_payloads.append(
            {
                "id": r.id,
                "summary": r.summary,
                "distance_miles": round(r.distance_miles, 1),
                "duration_hours": round(r.duration_seconds / 3600, 2),
                "geometry": [list(p) for p in r.geometry],
                "stats": {
                    "no_travel_miles": round(stats.no_travel_miles, 1),
                    "severe_miles": round(stats.severe_miles, 1),
                    "high_miles": round(stats.high_miles, 1),
                    "avg_risk": round(stats.avg_risk, 2),
                    "worst_risk": stats.worst.name,
                },
                "checkpoints": cp_payloads,
            }
        )

    ranked, reason = rank_routes(stats_by_id)
    for payload in route_payloads:
        payload["rank"] = ranked.index(payload["id"]) + 1
        payload["recommended"] = payload["id"] == ranked[0]

    return {
        "routes": route_payloads,
        "recommended_route_id": ranked[0],
        "recommendation_reason": reason,
    }

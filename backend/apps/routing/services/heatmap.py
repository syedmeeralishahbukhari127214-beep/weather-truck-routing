"""48-hour weather grid along the trip corridor, for the map heatmap + time slider.

The whole 0..48h dataset is returned in ONE response; the slider then works
entirely in the browser (no request per slider move).
Hour h means "departure + h hours", so hour 0 matches the route results.
"""
from datetime import datetime, timedelta
from typing import List, Sequence, Tuple

from ..models import Route
from . import weather
from .checkpoints import points_along
from .risk import assess_checkpoint

HOURS = 48
SPACING_MILES = 20
CELL_DEGREES = 0.1   # ~7 mi: points from different routes closer than this are merged
MAX_POINTS = 400


def corridor_points(routes: Sequence[Route]) -> List[Tuple[float, float]]:
    """(lat, lon) samples along every route; shared highways are not double counted."""
    seen, points = set(), []
    for route in routes:
        for lon, lat in points_along(route.geometry, SPACING_MILES):
            cell = (round(lat / CELL_DEGREES), round(lon / CELL_DEGREES))
            if cell not in seen:
                seen.add(cell)
                points.append((lat, lon))
    if len(points) > MAX_POINTS:
        stride = -(-len(points) // MAX_POINTS)  # ceil
        points = points[::stride]
    return points


def build_heatmap(routes: Sequence[Route], departure: datetime, load_lb: int) -> dict:
    points = corridor_points(routes)
    hours = [departure + timedelta(hours=h) for h in range(HOURS + 1)]
    forecasts = weather.fetch_forecasts(points, hours[0], hours[-1])

    out = []
    for lat, lon in points:
        fc = forecasts[weather.point_key(lat, lon)]
        risk, wind, rain, snow = [], [], [], []
        for t in hours:
            wx = weather.sample_at(fc, t)
            level = assess_checkpoint(wx.wind_mph, wx.rain_in_hr, wx.snow_in_hr, load_lb).overall
            risk.append(int(level))
            wind.append(round(wx.wind_mph, 1))
            rain.append(round(wx.rain_in_hr, 3))
            snow.append(round(wx.snow_in_hr, 2))
        out.append(
            {"lat": round(lat, 4), "lon": round(lon, 4), "risk": risk, "wind": wind, "rain": rain, "snow": snow}
        )
    return {"hours": [t.isoformat() for t in hours], "points": out}

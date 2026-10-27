"""Sample checkpoints along a route polyline and compute ETAs."""
from bisect import bisect_right
from datetime import datetime, timedelta
from typing import List, Sequence

from ..models import Checkpoint, LonLat
from .geo import cumulative_miles

ALLOWED_INTERVALS_MILES = (10, 25, 50)
_EPS = 0.01  # miles


def _point_at(coords: Sequence[LonLat], cumulative: Sequence[float], mile: float) -> LonLat:
    """Linear interpolation of the point `mile` miles along the line."""
    if mile <= 0:
        return coords[0]
    if mile >= cumulative[-1]:
        return coords[-1]
    i = bisect_right(cumulative, mile) - 1
    seg = cumulative[i + 1] - cumulative[i]
    t = (mile - cumulative[i]) / seg if seg else 0.0
    (lon1, lat1), (lon2, lat2) = coords[i], coords[i + 1]
    return (lon1 + (lon2 - lon1) * t, lat1 + (lat2 - lat1) * t)


def _mile_markers(total: float, interval: float) -> List[float]:
    marks = [0.0]
    m = interval
    while m < total - _EPS:
        marks.append(m)
        m += interval
    if total - marks[-1] > _EPS:
        marks.append(total)  # always sample the destination
    return marks


def _miles_represented(marks: Sequence[float], total: float) -> List[float]:
    """Each checkpoint covers the stretch halfway to its neighbours; sums to `total`."""
    if len(marks) == 1:
        return [total]
    bounds = [0.0] + [(a + b) / 2 for a, b in zip(marks, marks[1:])] + [total]
    return [bounds[i + 1] - bounds[i] for i in range(len(marks))]


def sample_checkpoints(
    coords: Sequence[LonLat],
    interval_miles: int,
    departure: datetime,
    duration_seconds: float,
) -> List[Checkpoint]:
    """Checkpoints every `interval_miles`, plus start and destination.

    ETA assumes constant average speed over the route:
        eta = departure + duration * (mile_marker / total_miles)
    """
    if len(coords) < 2:
        raise ValueError("A route needs at least two points")
    if interval_miles <= 0:
        raise ValueError("interval_miles must be positive")

    cumulative = cumulative_miles(coords)
    total = cumulative[-1]
    marks = _mile_markers(total, interval_miles)
    represented = _miles_represented(marks, total)

    checkpoints = []
    for i, (mile, span) in enumerate(zip(marks, represented)):
        lon, lat = _point_at(coords, cumulative, mile)
        fraction = mile / total if total else 0.0
        checkpoints.append(
            Checkpoint(
                index=i,
                mile_marker=round(mile, 2),
                lat=lat,
                lon=lon,
                eta=departure + timedelta(seconds=duration_seconds * fraction),
                miles_represented=round(span, 3),
            )
        )
    return checkpoints


def points_along(coords: Sequence[LonLat], interval_miles: float) -> List[LonLat]:
    """Evenly spaced (lon, lat) points along a line, including both ends."""
    if len(coords) < 2:
        raise ValueError("A route needs at least two points")
    if interval_miles <= 0:
        raise ValueError("interval_miles must be positive")
    cumulative = cumulative_miles(coords)
    return [_point_at(coords, cumulative, m) for m in _mile_markers(cumulative[-1], interval_miles)]

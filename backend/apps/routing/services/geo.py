"""Small geometry helpers (no I/O)."""
from math import asin, cos, radians, sin, sqrt
from typing import List, Sequence

from ..models import LonLat

EARTH_RADIUS_MILES = 3958.8


def haversine_miles(a: LonLat, b: LonLat) -> float:
    lon1, lat1, lon2, lat2 = map(radians, (a[0], a[1], b[0], b[1]))
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * asin(sqrt(h))


def cumulative_miles(coords: Sequence[LonLat]) -> List[float]:
    """cumulative[i] = miles from the start to coords[i]."""
    out = [0.0]
    for prev, cur in zip(coords, coords[1:]):
        out.append(out[-1] + haversine_miles(prev, cur))
    return out

"""Plain dataclasses shared by the services (no database involved)."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Tuple

# GeoJSON order: (longitude, latitude)
LonLat = Tuple[float, float]


@dataclass(frozen=True)
class Place:
    label: str
    lat: float
    lon: float


@dataclass(frozen=True)
class Route:
    id: str
    summary: str
    distance_miles: float
    duration_seconds: float
    geometry: List[LonLat]


@dataclass(frozen=True)
class Checkpoint:
    index: int
    mile_marker: float
    lat: float
    lon: float
    eta: datetime
    # How many route miles this checkpoint "speaks for" (used for Severe/High miles).
    miles_represented: float

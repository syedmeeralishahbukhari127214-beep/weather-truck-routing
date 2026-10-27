"""Route summaries and the recommendation rule. Pure functions, no I/O.

Spec order of preference: fewest Severe miles, fewest High miles,
lowest average risk, shortest travel time.

Extension: NO TRAVEL miles are compared first. A route with No Travel
segments is worse than any route without, even if it has fewer Severe miles.
"""
from dataclasses import dataclass
from typing import Callable, Dict, List, Sequence, Tuple

from ..constants import RiskLevel


@dataclass(frozen=True)
class RouteStats:
    distance_miles: float
    duration_seconds: float
    no_travel_miles: float
    severe_miles: float
    high_miles: float
    avg_risk: float  # mile-weighted mean of risk level, 0 (Low) .. 4 (No Travel)
    worst: RiskLevel


def summarize(
    segments: Sequence[Tuple[float, RiskLevel]], distance_miles: float, duration_seconds: float
) -> RouteStats:
    """`segments` = (miles_represented, overall risk) for every checkpoint."""
    total = sum(m for m, _ in segments)

    def miles_at(level: RiskLevel) -> float:
        return sum(m for m, lvl in segments if lvl == level)

    return RouteStats(
        distance_miles=distance_miles,
        duration_seconds=duration_seconds,
        no_travel_miles=miles_at(RiskLevel.NO_TRAVEL),
        severe_miles=miles_at(RiskLevel.SEVERE),
        high_miles=miles_at(RiskLevel.HIGH),
        avg_risk=sum(m * int(lvl) for m, lvl in segments) / total if total else 0.0,
        worst=max((lvl for _, lvl in segments), default=RiskLevel.LOW),
    )


# (label, value extractor, formatter). Values are rounded so that float noise
# (e.g. 49.999 vs 50.0 miles) never decides a ranking.
_CRITERIA: List[Tuple[str, Callable[[RouteStats], float], Callable[[float], str]]] = [
    ("Fewest No Travel miles", lambda s: round(s.no_travel_miles), lambda v: f"{v:.0f} mi"),
    ("Fewest Severe miles", lambda s: round(s.severe_miles), lambda v: f"{v:.0f} mi"),
    ("Fewest High miles", lambda s: round(s.high_miles), lambda v: f"{v:.0f} mi"),
    ("Lowest average risk", lambda s: round(s.avg_risk, 2), lambda v: f"{v:.2f}"),
    ("Shortest travel time", lambda s: round(s.duration_seconds / 60), lambda v: f"{v / 60:.1f} h"),
]


def _sort_key(stats: RouteStats) -> tuple:
    return tuple(extract(stats) for _, extract, _ in _CRITERIA)


def rank_routes(stats_by_id: Dict[str, RouteStats]) -> Tuple[List[str], str]:
    """Return (route ids best-first, human-readable reason for the winner)."""
    if not stats_by_id:
        raise ValueError("No routes to rank")
    ranked = sorted(stats_by_id, key=lambda rid: _sort_key(stats_by_id[rid]))
    if len(ranked) == 1:
        return ranked, "Only one route was available."

    best, runner_up = stats_by_id[ranked[0]], stats_by_id[ranked[1]]
    for label, extract, fmt in _CRITERIA:
        b, r = extract(best), extract(runner_up)
        if b != r:
            return ranked, f"{label}: {fmt(b)} vs {fmt(r)} on the next-best route."
    return ranked, "Routes are equivalent on every criterion."

"""Risk engine: pure functions, no I/O.

Input: weather at one checkpoint + the truck's load weight.
Output: a RiskLevel (and the per-factor breakdown for the UI).
"""
from dataclasses import dataclass

from ..constants import (
    HEAVY_LOAD_LB,
    MEDIUM_LOAD_LB,
    NO_TRAVEL_WIND_RANGE_MEDIUM_LOAD_MPH,
    RAIN_UPPER_BOUNDS_IN_HR,
    SEVERE_WIND_RANGE_HEAVY_LOAD_MPH,
    SNOW_UPPER_BOUNDS_IN_HR,
    WIND_UPPER_BOUNDS_MPH,
    RiskLevel,
)


@dataclass(frozen=True)
class CheckpointRisk:
    wind: RiskLevel
    rain: RiskLevel
    snow: RiskLevel
    overall: RiskLevel


def _classify(value: float, bounds: tuple) -> RiskLevel:
    """Walk the ladder of upper bounds; fall through to NO_TRAVEL."""
    for level, (upper, inclusive) in zip(RiskLevel, bounds):
        if value < upper or (inclusive and value == upper):
            return level
    return RiskLevel.NO_TRAVEL


def classify_wind(mph: float) -> RiskLevel:
    return _classify(mph, WIND_UPPER_BOUNDS_MPH)


def classify_rain(in_per_hr: float) -> RiskLevel:
    return _classify(in_per_hr, RAIN_UPPER_BOUNDS_IN_HR)


def classify_snow(in_per_hr: float) -> RiskLevel:
    return _classify(in_per_hr, SNOW_UPPER_BOUNDS_IN_HR)


def apply_load_rules(wind_level: RiskLevel, wind_mph: float, load_lb: float) -> RiskLevel:
    """Heavy loads escalate wind risk. Never lowers a level."""
    lo, hi = NO_TRAVEL_WIND_RANGE_MEDIUM_LOAD_MPH
    if lo <= wind_mph < hi and load_lb > MEDIUM_LOAD_LB:
        return max(wind_level, RiskLevel.NO_TRAVEL)

    lo, hi = SEVERE_WIND_RANGE_HEAVY_LOAD_MPH
    if lo <= wind_mph < hi and load_lb > HEAVY_LOAD_LB:
        return max(wind_level, RiskLevel.SEVERE)

    return wind_level


def assess_checkpoint(
    wind_mph: float, rain_in_hr: float, snow_in_hr: float, load_lb: float
) -> CheckpointRisk:
    """Overall risk = worst of wind (load-adjusted), rain and snow."""
    wind = apply_load_rules(classify_wind(wind_mph), wind_mph, load_lb)
    rain = classify_rain(rain_in_hr)
    snow = classify_snow(snow_in_hr)
    return CheckpointRisk(wind=wind, rain=rain, snow=snow, overall=max(wind, rain, snow))

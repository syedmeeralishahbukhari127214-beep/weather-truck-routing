"""Single source of truth for risk levels, thresholds and load rules."""
from enum import IntEnum


class RiskLevel(IntEnum):
    """Ordered so that max() gives the worst level."""

    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4

    @property
    def label(self) -> str:
        return self.name.replace("_", " ").title()


# Upper bounds of each level, in order: (LOW, MODERATE, HIGH, SEVERE).
# Anything above the last bound is NO_TRAVEL.
#
# Boundary conventions (the spec table has overlapping edges, e.g. rain
# "0.10-0.25" and "0.25-0.50"), so we fix them explicitly:
#   * Wind:       lower bound inclusive  -> 25 is Moderate, 55 is No Travel
#   * Rain/Snow:  upper bound inclusive  -> 0.25 in/hr is Moderate,
#                 1.00 in/hr rain is Severe, >1.00 is No Travel
#
# Each entry is (upper_bound, inclusive).
WIND_UPPER_BOUNDS_MPH = (
    (25, False),  # <25  Low
    (35, False),  # 25-34 Moderate
    (45, False),  # 35-44 High
    (55, False),  # 45-54 Severe, >=55 No Travel
)
RAIN_UPPER_BOUNDS_IN_HR = (
    (0.10, False),  # <0.10 Low
    (0.25, True),   # 0.10-0.25 Moderate
    (0.50, True),   # 0.25-0.50 High
    (1.00, True),   # 0.50-1.00 Severe, >1.00 No Travel
)
SNOW_UPPER_BOUNDS_IN_HR = (
    (0.5, False),  # <0.5 Low
    (1.0, True),   # 0.5-1.0 Moderate
    (2.0, True),   # 1.0-2.0 High
    (3.0, True),   # 2.0-3.0 Severe, >3.0 No Travel
)

# Load rules (weights in lb, wind in mph)
NO_TRAVEL_WIND_ANY_LOAD_MPH = 55
SEVERE_WIND_RANGE_HEAVY_LOAD_MPH = (35, 45)    # 35-44 + >40,000 lb -> Severe
NO_TRAVEL_WIND_RANGE_MEDIUM_LOAD_MPH = (45, 55)  # 45-54 + >30,000 lb -> No Travel
HEAVY_LOAD_LB = 40_000
MEDIUM_LOAD_LB = 30_000

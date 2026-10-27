from datetime import datetime, timezone
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase

from ..models import Place, Route
from ..services import trip, weather
from .helpers import make_fake_open_meteo

DEP = datetime(2026, 10, 26, 8, 0, tzinfo=timezone.utc)
ORIGIN, DEST = Place("A", 32.0, -97.0), Place("B", 32.0, -95.0)

# Route 1 runs along lat 32 (windy), route 2 along lat 33 (calm) but is slower.
ROUTES = [
    Route("route-1", "I-20", 117.0, 2 * 3600, [(-97.0, 32.0), (-96.0, 32.0), (-95.0, 32.0)]),
    Route("route-2", "I-30", 125.0, 3 * 3600, [(-97.0, 32.0), (-96.0, 33.0), (-95.0, 32.0)]),
]


def windy_south(lat, lon, t):
    return (40.0, 0.0, 0.0) if lat < 32.5 else (10.0, 0.0, 0.0)


class TripTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def run_trip(self, load, weather_fn=windy_south, interval=25):
        with patch.object(trip.mapbox, "get_routes", return_value=ROUTES), patch.object(
            weather, "_request", side_effect=make_fake_open_meteo(weather_fn)
        ):
            return trip.plan_trip(ORIGIN, DEST, DEP, load, interval)

    def test_heavy_load_makes_wind_severe_and_calm_route_wins(self):
        result = self.run_trip(load=45_000)
        r1 = next(r for r in result["routes"] if r["id"] == "route-1")
        self.assertGreater(r1["stats"]["severe_miles"], 0)
        self.assertEqual(result["recommended_route_id"], "route-2")
        self.assertIn("Severe", result["recommendation_reason"])

    def test_light_load_same_wind_is_only_high(self):
        result = self.run_trip(load=20_000)
        r1 = next(r for r in result["routes"] if r["id"] == "route-1")
        self.assertEqual(r1["stats"]["severe_miles"], 0)
        self.assertGreater(r1["stats"]["high_miles"], 0)

    def test_fastest_route_wins_when_weather_is_clear(self):
        result = self.run_trip(load=45_000, weather_fn=lambda *a: (5.0, 0.0, 0.0))
        self.assertEqual(result["recommended_route_id"], "route-1")
        self.assertIn("travel time", result["recommendation_reason"])

    def test_each_checkpoint_carries_weather_risk_and_eta(self):
        result = self.run_trip(load=45_000)
        cp = result["routes"][0]["checkpoints"][1]
        self.assertEqual(set(cp), {"index", "mile_marker", "lat", "lon", "eta",
                                   "miles_represented", "weather", "risk"})
        self.assertEqual(cp["risk"]["level"], "SEVERE")

    def test_weather_is_sampled_at_eta_not_departure(self):
        # Wind is calm until 10:00 UTC, then storm. Route 1 takes 2h (08:00 -> 10:00).
        def storm_after_10(lat, lon, t):
            return (60.0, 0.0, 0.0) if t.hour >= 10 else (5.0, 0.0, 0.0)

        result = self.run_trip(load=1_000, weather_fn=storm_after_10, interval=50)
        cps = result["routes"][0]["checkpoints"]
        self.assertEqual(cps[0]["risk"]["level"], "LOW")           # 08:00
        self.assertEqual(cps[-1]["risk"]["level"], "NO_TRAVEL")    # 10:00 arrival

    def test_one_weather_request_for_all_routes(self):
        with patch.object(trip.mapbox, "get_routes", return_value=ROUTES), patch.object(
            weather, "_request", side_effect=make_fake_open_meteo(windy_south)
        ) as req:
            trip.plan_trip(ORIGIN, DEST, DEP, 10_000, 25)
        self.assertEqual(req.call_count, 1)

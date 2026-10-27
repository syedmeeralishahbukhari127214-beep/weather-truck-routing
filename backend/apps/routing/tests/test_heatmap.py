from datetime import datetime, timezone
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient

from ..models import Place, Route
from ..services import heatmap, mapbox, weather
from .helpers import make_fake_open_meteo

DEP = datetime(2026, 10, 26, 8, 0, tzinfo=timezone.utc)
# 2 degrees of longitude at lat 32 is ~117 miles
ROUTE_A = Route("route-1", "I-20", 207.0, 3 * 3600, [(-97.0, 32.0), (-95.0, 32.0)])
# Same highway sampled on a slightly different geometry -> should be merged
ROUTE_B = Route("route-2", "US-80", 207.0, 3 * 3600, [(-97.0, 32.01), (-95.0, 32.01)])


class CorridorPointTests(SimpleTestCase):
    def test_points_follow_spacing(self):
        pts = heatmap.corridor_points([ROUTE_A])
        self.assertEqual(len(pts), 7)  # miles 0,20,...,100 + destination

    def test_overlapping_routes_are_not_double_counted(self):
        self.assertEqual(
            len(heatmap.corridor_points([ROUTE_A, ROUTE_B])), len(heatmap.corridor_points([ROUTE_A]))
        )

    def test_point_cap(self):
        long_route = Route("x", "x", 0, 0, [(-120.0, 35.0), (-70.0, 35.0)])
        with patch.object(heatmap, "MAX_POINTS", 20):
            self.assertLessEqual(len(heatmap.corridor_points([long_route])), 20)


class BuildHeatmapTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def build(self, weather_fn, load=45_000):
        with patch.object(weather, "_request", side_effect=make_fake_open_meteo(weather_fn)) as req:
            return heatmap.build_heatmap([ROUTE_A], DEP, load), req

    def test_shape_49_hours_for_every_point(self):
        data, _ = self.build(lambda *a: (10.0, 0.0, 0.0))
        self.assertEqual(len(data["hours"]), 49)
        self.assertEqual(data["hours"][0], DEP.isoformat())
        for p in data["points"]:
            self.assertTrue(all(len(p[k]) == 49 for k in ("risk", "wind", "rain", "snow")))

    def test_risk_changes_with_forecast_hour_and_load(self):
        def storm_from_noon(lat, lon, t):  # hour 4 of the slider is 12:00 UTC
            return (40.0, 0.0, 0.0) if t.day == 26 and t.hour >= 12 else (5.0, 0.0, 0.0)

        heavy, _ = self.build(storm_from_noon, load=45_000)
        light, _ = self.build(storm_from_noon, load=20_000)
        self.assertEqual(heavy["points"][0]["risk"][0], 0)   # calm at departure
        self.assertEqual(heavy["points"][0]["risk"][4], 3)   # 40 mph + heavy load = Severe
        self.assertEqual(light["points"][0]["risk"][4], 2)   # same wind, light load = High

    def test_single_batched_weather_request(self):
        _, req = self.build(lambda *a: (10.0, 0.0, 0.0))
        self.assertEqual(req.call_count, 1)


@override_settings(MAPBOX_TOKEN="test")
class HeatmapViewTests(SimpleTestCase):
    body = {
        "origin": {"lat": 32.0, "lon": -97.0},
        "destination": {"lat": 32.0, "lon": -95.0},
        "departure": "2026-10-26T08:00:00Z",
        "load_lb": 45000,
    }

    def setUp(self):
        cache.clear()

    def test_endpoint(self):
        fake = make_fake_open_meteo(lambda *a: (10.0, 0.0, 0.0))
        with patch.object(mapbox, "get_routes", return_value=[ROUTE_A]), patch.object(
            weather, "_request", side_effect=fake
        ):
            res = APIClient().post("/api/heatmap/", self.body, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()["hours"]), 49)

    def test_provider_failure_is_502(self):
        with patch.object(mapbox, "get_routes", side_effect=mapbox.MapboxError("no token")):
            res = APIClient().post("/api/heatmap/", self.body, format="json")
        self.assertEqual(res.status_code, 502)


class RouteCacheTests(SimpleTestCase):
    def test_second_lookup_does_not_call_mapbox(self):
        cache.clear()
        payload = {"code": "Ok", "routes": [{"distance": 1609.344, "duration": 60,
                   "legs": [{"summary": "X"}], "geometry": {"coordinates": [[0, 0], [1, 1]]}}]}
        with patch.object(mapbox, "_get", return_value=payload) as get:
            a = mapbox.get_routes(Place("a", 1, 1), Place("b", 2, 2))
            b = mapbox.get_routes(Place("a", 1, 1), Place("b", 2, 2))
        self.assertEqual(get.call_count, 1)
        self.assertEqual(a, b)

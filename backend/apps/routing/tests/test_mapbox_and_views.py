from unittest.mock import patch

from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient

from django.core.cache import cache

from ..services import mapbox, weather
from .helpers import make_fake_open_meteo

DIRECTIONS = {
    "code": "Ok",
    "routes": [
        {
            "distance": 160934.4,  # 100 miles
            "duration": 5400,
            "legs": [{"summary": "I-35 N, I-70 W"}],
            "geometry": {"coordinates": [[-97.0, 32.0], [-96.0, 32.0], [-95.0, 32.0]]},
        },
        {
            "distance": 170000,
            "duration": 6000,
            "legs": [{"summary": "US-75 N"}],
            "geometry": {"coordinates": [[-97.0, 32.0], [-95.0, 32.0]]},
        },
    ],
}
GEOCODE = {
    "features": [
        {"properties": {"full_address": "Dallas, Texas, United States"},
         "geometry": {"coordinates": [-96.8, 32.78]}}
    ]
}


class ParseTests(SimpleTestCase):
    def test_parse_routes(self):
        routes = mapbox.parse_routes(DIRECTIONS)
        self.assertEqual([r.id for r in routes], ["route-1", "route-2"])
        self.assertAlmostEqual(routes[0].distance_miles, 100, places=3)
        self.assertEqual(routes[0].summary, "I-35 N, I-70 W")

    def test_parse_routes_caps_at_three(self):
        payload = {"code": "Ok", "routes": DIRECTIONS["routes"] * 3}
        self.assertEqual(len(mapbox.parse_routes(payload)), 3)

    def test_no_route_raises(self):
        with self.assertRaises(mapbox.MapboxError):
            mapbox.parse_routes({"code": "NoRoute", "routes": []})

    def test_parse_places(self):
        p = mapbox.parse_places(GEOCODE)[0]
        self.assertEqual((p.label, p.lat, p.lon), ("Dallas, Texas, United States", 32.78, -96.8))


@override_settings(MAPBOX_TOKEN="test")
class ViewTests(SimpleTestCase):
    body = {
        "origin": {"lat": 32.0, "lon": -97.0},
        "destination": {"lat": 32.0, "lon": -95.0},
        "departure": "2026-10-26T08:00:00Z",
        "load_lb": 45000,
        "interval_miles": 25,
    }

    def setUp(self):
        cache.clear()
        self.client = APIClient()

    @patch("apps.routing.services.mapbox._get", return_value=DIRECTIONS)
    def test_routes_endpoint(self, _):
        fake = make_fake_open_meteo(lambda *a: (10.0, 0.0, 0.0))
        with patch.object(weather, "_request", side_effect=fake):
            res = self.client.post("/api/routes/", self.body, format="json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["routes"]), 2)
        self.assertIn(data["recommended_route_id"], {"route-1", "route-2"})
        cps = data["routes"][0]["checkpoints"]
        self.assertEqual(cps[0]["mile_marker"], 0)
        self.assertEqual(cps[0]["eta"], "2026-10-26T08:00:00+00:00")
        self.assertEqual(cps[0]["risk"]["level"], "LOW")

    @patch("apps.routing.services.mapbox._get", return_value=DIRECTIONS)
    def test_weather_failure_is_502(self, _):
        with patch.object(weather, "_request", side_effect=weather.WeatherError("down")):
            res = self.client.post("/api/routes/", self.body, format="json")
        self.assertEqual(res.status_code, 502)
        self.assertEqual(res.json()["error"], "down")

    def test_invalid_interval_rejected(self):
        res = self.client.post("/api/routes/", {**self.body, "interval_miles": 7}, format="json")
        self.assertEqual(res.status_code, 400)

    @patch("apps.routing.services.mapbox._get", side_effect=mapbox.MapboxError("boom"))
    def test_mapbox_failure_is_502(self, _):
        res = self.client.post("/api/routes/", self.body, format="json")
        self.assertEqual(res.status_code, 502)

    @patch("apps.routing.services.mapbox._get", return_value=GEOCODE)
    def test_geocode_endpoint(self, _):
        res = self.client.get("/api/geocode/?q=Dallas")
        self.assertEqual(res.json()[0]["label"], "Dallas, Texas, United States")

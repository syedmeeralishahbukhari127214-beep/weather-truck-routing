from datetime import datetime, timezone
from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase

from ..services import weather
from .helpers import make_fake_open_meteo

T0 = datetime(2026, 10, 26, 0, 0, tzinfo=timezone.utc)


def calm(lat, lon, t):
    return (10.0, 0.0, 0.0)


class ParseAndSampleTests(SimpleTestCase):
    def payload(self):
        return make_fake_open_meteo(lambda la, lo, t: (t.hour * 1.0, 0.05, 0.0))(
            {"latitude": "32.0", "longitude": "-97.0",
             "start_date": "2026-10-26", "end_date": "2026-10-26"}
        )

    def test_single_location_dict_is_parsed(self):
        (fc,) = weather.parse_forecasts(self.payload())
        self.assertEqual(len(fc.times), 24)

    def test_rain_and_showers_are_summed(self):
        p = self.payload()
        p["hourly"]["showers"][3] = 0.2
        (fc,) = weather.parse_forecasts(p)
        self.assertAlmostEqual(fc.rain_in[3], 0.25)

    def test_sample_uses_nearest_hour(self):
        (fc,) = weather.parse_forecasts(self.payload())
        s = weather.sample_at(fc, datetime(2026, 10, 26, 13, 20, tzinfo=timezone.utc))
        self.assertEqual(s.wind_mph, 13.0)
        s = weather.sample_at(fc, datetime(2026, 10, 26, 13, 40, tzinfo=timezone.utc))
        self.assertEqual(s.wind_mph, 14.0)

    def test_sample_outside_range_raises(self):
        (fc,) = weather.parse_forecasts(self.payload())
        with self.assertRaises(weather.WeatherError):
            weather.sample_at(fc, datetime(2026, 10, 28, 0, 0, tzinfo=timezone.utc))

    def test_null_values_raise(self):
        p = self.payload()
        p["hourly"]["wind_speed_10m"][5] = None
        (fc,) = weather.parse_forecasts(p)
        with self.assertRaises(weather.WeatherError):
            weather.sample_at(fc, datetime(2026, 10, 26, 5, 0, tzinfo=timezone.utc))


class FetchTests(SimpleTestCase):
    def setUp(self):
        cache.clear()

    def test_points_are_deduplicated_and_batched(self):
        points = [(32.001, -97.002), (32.004, -97.001)] + [(30 + i * 0.1, -95.0) for i in range(120)]
        with patch.object(weather, "_request", side_effect=make_fake_open_meteo(calm)) as req:
            out = weather.fetch_forecasts(points, T0, T0)
        # first two points round to the same key
        self.assertEqual(len(out), 121)
        self.assertEqual(req.call_count, 3)  # 121 keys / 50 per request

    def test_second_call_is_served_from_cache(self):
        with patch.object(weather, "_request", side_effect=make_fake_open_meteo(calm)) as req:
            weather.fetch_forecasts([(32.0, -97.0)], T0, T0)
            weather.fetch_forecasts([(32.0, -97.0)], T0, T0)
        self.assertEqual(req.call_count, 1)

    def test_provider_error_propagates(self):
        with patch.object(weather, "_request", side_effect=weather.WeatherError("nope")):
            with self.assertRaises(weather.WeatherError):
                weather.fetch_forecasts([(32.0, -97.0)], T0, T0)

"""Fake Open-Meteo: builds a realistic response for whatever the code asks for."""
from datetime import date, datetime, timedelta


def make_fake_open_meteo(weather_fn):
    """weather_fn(lat, lon, hour_datetime) -> (wind_mph, rain_in, snow_in)."""

    def fake(params):
        lats = [float(x) for x in params["latitude"].split(",")]
        lons = [float(x) for x in params["longitude"].split(",")]
        d, end = date.fromisoformat(params["start_date"]), date.fromisoformat(params["end_date"])
        hours = []
        while d <= end:
            hours += [datetime(d.year, d.month, d.day, h) for h in range(24)]
            d += timedelta(days=1)
        results = []
        for lat, lon in zip(lats, lons):
            vals = [weather_fn(lat, lon, t) for t in hours]
            results.append(
                {
                    "hourly": {
                        "time": [t.strftime("%Y-%m-%dT%H:%M") for t in hours],
                        "wind_speed_10m": [v[0] for v in vals],
                        "rain": [v[1] for v in vals],
                        "showers": [0.0] * len(vals),
                        "snowfall": [v[2] for v in vals],
                    }
                }
            )
        return results if len(results) > 1 else results[0]

    return fake

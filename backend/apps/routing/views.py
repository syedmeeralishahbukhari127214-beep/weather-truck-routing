from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Place
from .serializers import TripRequestSerializer
from .services import mapbox
from .services.heatmap import build_heatmap
from .services.trip import plan_trip
from .services.weather import WeatherError


@api_view(["GET"])
def health(request):
    return Response({"status": "ok"})


@api_view(["GET"])
def geocode(request):
    query = request.query_params.get("q", "").strip()
    if len(query) < 2:
        return Response([])
    try:
        places = mapbox.geocode(query)
    except mapbox.MapboxError as exc:
        return Response({"error": str(exc)}, status=502)
    return Response([{"label": p.label, "lat": p.lat, "lon": p.lon} for p in places])


@api_view(["POST"])
def routes(request):
    """3 routes with checkpoints, ETAs, weather, risk and a recommendation."""
    ser = TripRequestSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    d = ser.validated_data

    origin = Place(d["origin"]["label"], d["origin"]["lat"], d["origin"]["lon"])
    dest = Place(d["destination"]["label"], d["destination"]["lat"], d["destination"]["lon"])

    try:
        result = plan_trip(origin, dest, d["departure"], d["load_lb"], d["interval_miles"])
    except (mapbox.MapboxError, WeatherError) as exc:
        return Response({"error": str(exc)}, status=502)
    return Response(result)


@api_view(["POST"])
def heatmap(request):
    """0-48h weather risk along the corridor of all routes (same body as /routes/)."""
    ser = TripRequestSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    d = ser.validated_data

    origin = Place(d["origin"]["label"], d["origin"]["lat"], d["origin"]["lon"])
    dest = Place(d["destination"]["label"], d["destination"]["lat"], d["destination"]["lon"])
    try:
        found = mapbox.get_routes(origin, dest)
        result = build_heatmap(found, d["departure"], d["load_lb"])
    except (mapbox.MapboxError, WeatherError) as exc:
        return Response({"error": str(exc)}, status=502)
    return Response(result)

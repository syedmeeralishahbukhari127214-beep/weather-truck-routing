from rest_framework import serializers

from .services.checkpoints import ALLOWED_INTERVALS_MILES


class PointSerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=-90, max_value=90)
    lon = serializers.FloatField(min_value=-180, max_value=180)
    label = serializers.CharField(required=False, allow_blank=True, default="")


class TripRequestSerializer(serializers.Serializer):
    origin = PointSerializer()
    destination = PointSerializer()
    departure = serializers.DateTimeField()
    load_lb = serializers.IntegerField(min_value=0, max_value=200_000)
    interval_miles = serializers.ChoiceField(choices=ALLOWED_INTERVALS_MILES, default=25)

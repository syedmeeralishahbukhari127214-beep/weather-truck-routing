from django.test import SimpleTestCase

from ..constants import RiskLevel as R
from ..services.risk import (
    apply_load_rules,
    assess_checkpoint,
    classify_rain,
    classify_snow,
    classify_wind,
)


class WindTests(SimpleTestCase):
    def test_bands(self):
        cases = [(0, R.LOW), (24.9, R.LOW), (25, R.MODERATE), (34, R.MODERATE),
                 (35, R.HIGH), (44, R.HIGH), (45, R.SEVERE), (54, R.SEVERE),
                 (55, R.NO_TRAVEL), (80, R.NO_TRAVEL)]
        for mph, expected in cases:
            with self.subTest(mph=mph):
                self.assertEqual(classify_wind(mph), expected)


class RainTests(SimpleTestCase):
    def test_bands(self):
        cases = [(0, R.LOW), (0.09, R.LOW), (0.10, R.MODERATE), (0.25, R.MODERATE),
                 (0.26, R.HIGH), (0.50, R.HIGH), (0.51, R.SEVERE), (1.00, R.SEVERE),
                 (1.01, R.NO_TRAVEL)]
        for v, expected in cases:
            with self.subTest(rain=v):
                self.assertEqual(classify_rain(v), expected)


class SnowTests(SimpleTestCase):
    def test_bands(self):
        cases = [(0, R.LOW), (0.49, R.LOW), (0.5, R.MODERATE), (1.0, R.MODERATE),
                 (1.1, R.HIGH), (2.0, R.HIGH), (2.1, R.SEVERE), (3.0, R.SEVERE),
                 (3.1, R.NO_TRAVEL)]
        for v, expected in cases:
            with self.subTest(snow=v):
                self.assertEqual(classify_snow(v), expected)


class LoadRuleTests(SimpleTestCase):
    def test_55_mph_no_travel_for_any_load(self):
        r = assess_checkpoint(55, 0, 0, load_lb=1_000)
        self.assertEqual(r.overall, R.NO_TRAVEL)

    def test_45_54_with_over_30k_is_no_travel(self):
        self.assertEqual(assess_checkpoint(50, 0, 0, 30_001).overall, R.NO_TRAVEL)

    def test_45_54_with_30k_or_less_stays_severe(self):
        self.assertEqual(assess_checkpoint(50, 0, 0, 30_000).overall, R.SEVERE)

    def test_35_44_with_over_40k_is_severe(self):
        self.assertEqual(assess_checkpoint(40, 0, 0, 40_001).overall, R.SEVERE)

    def test_35_44_with_40k_or_less_stays_high(self):
        self.assertEqual(assess_checkpoint(40, 0, 0, 40_000).overall, R.HIGH)

    def test_light_wind_not_affected_by_heavy_load(self):
        self.assertEqual(assess_checkpoint(20, 0, 0, 80_000).overall, R.LOW)

    def test_load_rule_never_lowers_level(self):
        self.assertEqual(apply_load_rules(R.NO_TRAVEL, 40, 50_000), R.NO_TRAVEL)


class OverallTests(SimpleTestCase):
    def test_worst_factor_wins(self):
        r = assess_checkpoint(wind_mph=10, rain_in_hr=0.3, snow_in_hr=2.5, load_lb=10_000)
        self.assertEqual((r.wind, r.rain, r.snow), (R.LOW, R.HIGH, R.SEVERE))
        self.assertEqual(r.overall, R.SEVERE)

    def test_all_clear(self):
        self.assertEqual(assess_checkpoint(5, 0, 0, 40_000).overall, R.LOW)

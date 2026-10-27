from datetime import datetime, timezone

from django.test import SimpleTestCase

from ..services.checkpoints import sample_checkpoints
from ..services.geo import cumulative_miles, haversine_miles

DEP = datetime(2026, 10, 26, 8, 0, tzinfo=timezone.utc)
# Straight line along the equator: 1 degree of longitude ≈ 69.09 miles
LINE = [(0.0, 0.0), (0.5, 0.0), (1.0, 0.0)]


class GeoTests(SimpleTestCase):
    def test_haversine_one_degree_equator(self):
        self.assertAlmostEqual(haversine_miles((0, 0), (1, 0)), 69.09, places=1)

    def test_cumulative_is_monotonic(self):
        c = cumulative_miles(LINE)
        self.assertEqual(c[0], 0)
        self.assertTrue(c[0] < c[1] < c[2])


class CheckpointTests(SimpleTestCase):
    def test_markers_include_start_interval_steps_and_destination(self):
        cps = sample_checkpoints(LINE, 25, DEP, 3600)
        self.assertEqual([c.mile_marker for c in cps], [0, 25, 50, 69.09])

    def test_interval_larger_than_route_gives_start_and_end(self):
        cps = sample_checkpoints(LINE, 100, DEP, 3600)
        self.assertEqual(len(cps), 2)

    def test_first_is_origin_last_is_destination(self):
        cps = sample_checkpoints(LINE, 10, DEP, 3600)
        self.assertEqual((cps[0].lon, cps[0].lat), (0.0, 0.0))
        self.assertAlmostEqual(cps[-1].lon, 1.0, places=6)

    def test_interpolated_point_lies_on_line(self):
        cps = sample_checkpoints(LINE, 25, DEP, 3600)
        self.assertAlmostEqual(cps[1].lat, 0.0, places=6)
        self.assertAlmostEqual(cps[1].lon, 25 / 69.09, places=3)

    def test_eta_scales_with_distance(self):
        cps = sample_checkpoints(LINE, 25, DEP, 3600)  # 1 hour total
        self.assertEqual(cps[0].eta, DEP)
        self.assertAlmostEqual((cps[-1].eta - DEP).total_seconds(), 3600, places=0)
        mid = (cps[2].eta - DEP).total_seconds()
        self.assertAlmostEqual(mid, 3600 * 50 / 69.09, delta=2)

    def test_miles_represented_sums_to_total(self):
        cps = sample_checkpoints(LINE, 25, DEP, 3600)
        self.assertAlmostEqual(sum(c.miles_represented for c in cps), 69.09, delta=0.05)

    def test_zero_length_route_has_single_checkpoint(self):
        cps = sample_checkpoints([(1, 1), (1, 1)], 25, DEP, 0)
        self.assertEqual(len(cps), 1)

    def test_invalid_input(self):
        with self.assertRaises(ValueError):
            sample_checkpoints([(0, 0)], 25, DEP, 10)
        with self.assertRaises(ValueError):
            sample_checkpoints(LINE, 0, DEP, 10)

from django.test import SimpleTestCase

from ..constants import RiskLevel as R
from ..services.recommender import rank_routes, summarize

L, M, H, S, N = R.LOW, R.MODERATE, R.HIGH, R.SEVERE, R.NO_TRAVEL


def stats(segments, hours=5):
    return summarize(segments, distance_miles=sum(m for m, _ in segments), duration_seconds=hours * 3600)


class SummarizeTests(SimpleTestCase):
    def test_miles_per_level_and_average(self):
        s = stats([(50, L), (25, H), (25, S)])
        self.assertEqual((s.high_miles, s.severe_miles, s.no_travel_miles), (25, 25, 0))
        self.assertAlmostEqual(s.avg_risk, (0 * 50 + 2 * 25 + 3 * 25) / 100)
        self.assertEqual(s.worst, S)

    def test_empty_is_low(self):
        s = summarize([], 0, 0)
        self.assertEqual((s.avg_risk, s.worst), (0.0, L))


class RankingTests(SimpleTestCase):
    def best(self, **routes):
        ranked, reason = rank_routes(routes)
        return ranked[0], reason

    def test_fewest_severe_beats_everything_else(self):
        # A is faster and has fewer High miles, but has Severe miles.
        best, reason = self.best(
            A=stats([(100, L), (10, S)], hours=3), B=stats([(60, H), (50, H)], hours=9)
        )
        self.assertEqual(best, "B")
        self.assertIn("Severe", reason)

    def test_high_miles_break_severe_tie(self):
        best, reason = self.best(A=stats([(100, H)], hours=3), B=stats([(100, M)], hours=9))
        self.assertEqual(best, "B")
        self.assertIn("High", reason)

    def test_average_risk_breaks_tie(self):
        best, reason = self.best(A=stats([(100, M)], hours=3), B=stats([(100, L)], hours=9))
        self.assertEqual(best, "B")
        self.assertIn("average risk", reason)

    def test_time_is_last_tiebreaker(self):
        best, reason = self.best(A=stats([(100, L)], hours=6), B=stats([(100, L)], hours=5))
        self.assertEqual(best, "B")
        self.assertIn("travel time", reason)

    def test_no_travel_route_loses_to_clear_route(self):
        best, _ = self.best(A=stats([(100, L), (10, N)]), B=stats([(100, S)]))
        self.assertEqual(best, "B")

    def test_float_noise_does_not_decide(self):
        best, _ = self.best(A=stats([(100, L), (49.999, S)], hours=5), B=stats([(100, L), (50.0, S)], hours=4))
        self.assertEqual(best, "B")  # equal Severe miles -> falls through to time

    def test_single_route(self):
        ranked, reason = rank_routes({"A": stats([(10, L)])})
        self.assertEqual(ranked, ["A"])
        self.assertIn("Only one", reason)

    def test_ranking_order_is_full(self):
        ranked, _ = rank_routes(
            {"A": stats([(100, S)]), "B": stats([(100, L)]), "C": stats([(100, H)])}
        )
        self.assertEqual(ranked, ["B", "C", "A"])

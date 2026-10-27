import test from "node:test";
import assert from "node:assert/strict";
import { cumulativeMiles, riskSegments, sliceLine, haversineMiles } from "./geo.js";

// Straight line along the equator, ~69.09 miles per degree of longitude.
const LINE = [[0, 0], [0.5, 0], [1, 0]];

test("haversine matches the backend (1 degree at the equator)", () => {
  assert.ok(Math.abs(haversineMiles([0, 0], [1, 0]) - 69.09) < 0.05);
});

test("sliceLine returns the requested stretch, interpolated at the ends", () => {
  const cum = cumulativeMiles(LINE);
  const piece = sliceLine(LINE, cum, 10, 50);
  const len = cumulativeMiles(piece).at(-1);
  assert.ok(Math.abs(len - 40) < 0.01);
});

test("riskSegments tile the whole route with no gaps or overlaps", () => {
  const cum = cumulativeMiles(LINE);
  const total = cum.at(-1);
  const route = {
    geometry: LINE,
    checkpoints: [0, 25, 50, total].map((m, i) => ({ index: i, mile_marker: m, risk: { level: i === 1 ? "SEVERE" : "LOW" } })),
  };
  const { features } = riskSegments(route, (k) => k);
  assert.equal(features.length, 4);
  const sum = features.reduce((s, f) => s + cumulativeMiles(f.geometry.coordinates).at(-1), 0);
  assert.ok(Math.abs(sum - total) < 0.01);
  // the checkpoint at mile 25 covers miles 12.5 .. 37.5 = 25 miles
  const severe = features.find((f) => f.properties.color === "SEVERE");
  assert.ok(Math.abs(cumulativeMiles(severe.geometry.coordinates).at(-1) - 25) < 0.01);
});

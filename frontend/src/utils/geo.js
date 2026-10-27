const EARTH_RADIUS_MILES = 3958.8;
const rad = (d) => (d * Math.PI) / 180;

// Same formula as the backend so mile markers line up with the polyline.
export function haversineMiles([lon1, lat1], [lon2, lat2]) {
  const h =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

export function cumulativeMiles(coords) {
  const out = [0];
  for (let i = 1; i < coords.length; i++) out.push(out[i - 1] + haversineMiles(coords[i - 1], coords[i]));
  return out;
}

// first index whose cumulative distance is > mile
function upperBound(cum, mile) {
  let lo = 0;
  let hi = cum.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= mile) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function pointAt(coords, cum, mile) {
  if (mile <= 0) return coords[0];
  const i = upperBound(cum, mile);
  if (i >= coords.length) return coords[coords.length - 1];
  const seg = cum[i] - cum[i - 1];
  const t = seg ? (mile - cum[i - 1]) / seg : 0;
  const [x1, y1] = coords[i - 1];
  const [x2, y2] = coords[i];
  return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
}

export function sliceLine(coords, cum, fromMile, toMile) {
  const out = [pointAt(coords, cum, fromMile)];
  for (let i = upperBound(cum, fromMile); i < coords.length && cum[i] < toMile; i++) out.push(coords[i]);
  out.push(pointAt(coords, cum, toMile));
  return out;
}

/**
 * Split a route into coloured stretches, one per checkpoint. Each checkpoint
 * covers the ground halfway to its neighbours, exactly like the backend's
 * `miles_represented`, so the colours match the Severe/High mile totals.
 */
export function riskSegments(route, colorOf) {
  const { geometry, checkpoints } = route;
  const cum = cumulativeMiles(geometry);
  const total = cum[cum.length - 1];
  const marks = checkpoints.map((c) => c.mile_marker);
  const features = [];
  checkpoints.forEach((cp, i) => {
    const from = i === 0 ? 0 : (marks[i - 1] + marks[i]) / 2;
    const to = i === checkpoints.length - 1 ? total : (marks[i] + marks[i + 1]) / 2;
    if (to - from <= 0) return;
    features.push({
      type: "Feature",
      properties: { color: colorOf(cp.risk.level) },
      geometry: { type: "LineString", coordinates: sliceLine(geometry, cum, from, to) },
    });
  });
  return { type: "FeatureCollection", features };
}

export function boundsOf(routes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  routes.forEach((r) =>
    r.geometry.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    })
  );
  return [[minX, minY], [maxX, maxY]];
}

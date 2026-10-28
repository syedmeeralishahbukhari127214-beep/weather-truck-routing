# Weather-Aware Truck Routing

React + Django app that recommends the safest of up to 3 truck routes based on weather, load weight and travel time.

> Status: backend and frontend complete.  

> Live URL: https://frontend-three-jade-10.vercel.app/  
> Loom Demo: https://www.loom.com/share/36889d3cbd784a87bfb0a55748b8a9e4

## How it works
1. **Routes**: Mapbox Directions returns the fastest route plus alternatives (max 3).
2. **Checkpoints**: every 10 / 25 / 50 miles along each route polyline, plus origin and destination.
3. **ETA**: `departure + route_duration * (mile_marker / total_miles)` (constant average speed).
4. **Weather**: Open-Meteo hourly forecast (mph / inches), taken for the hour nearest each checkpoint's **ETA**. All distinct points across all routes go in one batched, cached, parallel fetch.
5. **Risk**: per checkpoint, worst of wind (after load rules), rain and snow.
6. **Recommendation**: see below.

## Risk rules
Thresholds live in `backend/apps/routing/constants.py`; logic in `services/risk.py` (pure functions).

| Condition | Low | Moderate | High | Severe | No Travel |
|---|---|---|---|---|---|
| Wind (mph) | <25 | 25-34 | 35-44 | 45-54 | >=55 |
| Rain (in/hr) | <0.10 | 0.10-0.25 | 0.25-0.50 | 0.50-1.00 | >1.00 |
| Snow (in/hr) | <0.5 | 0.5-1.0 | 1.0-2.0 | 2.0-3.0 | >3.0 |

Load rules: wind >=55 is No Travel for any load; wind 45-54 with load >30,000 lb is No Travel; wind 35-44 with load >40,000 lb is Severe. Load rules only ever raise a level.

**Boundary convention** (the table's edges overlap): wind uses lower-bound-inclusive (25 mph = Moderate); rain/snow use upper-bound-inclusive (0.25 in/hr = Moderate, 1.00 in/hr rain = Severe, matching the spec's ">1.00").

## Recommendation
Strict lexicographic order: fewest Severe miles, fewest High miles, lowest average risk, shortest time.
- "Miles" = each checkpoint's `miles_represented` (the stretch halfway to its neighbours; sums to route length).
- Average risk is mile-weighted, Low=0 ... No Travel=4.
- **Addition to the spec:** No Travel miles are compared first, since No Travel is worse than Severe.
- Values are rounded (whole miles, 0.01 risk, minutes) so float noise never decides a ranking.
- The API returns a one-line reason (e.g. "Fewest Severe miles: 0 mi vs 45 mi on the next-best route.").

## Assumptions and limitations
- Mapbox `driving` is a car profile (no truck profile), so durations can be optimistic and routes ignore truck restrictions.
- Mapbox may return fewer than 3 routes when no meaningful alternatives exist.
- Wind is sustained 10 m wind speed (not gusts). Rain = `rain + showers`; snow = `snowfall` in inches per hour.
- Forecast is only available ~16 days ahead; later departures return a clear error.

## Heatmap and time slider
`POST /api/heatmap/` samples the corridor of all routes every 20 miles (routes sharing a highway are merged, capped at 400 points) and returns risk, wind, rain and snow for **every hour from departure to +48 h** in one response. The slider then runs entirely in the browser: moving it swaps one number per point and redraws a Mapbox heatmap layer, with no network request. The slider track is painted with the worst risk on the corridor for each hour, so you can see when conditions turn bad. Hour 0 matches the route results exactly (same load rules, same forecast).

## API
- `GET /api/geocode/?q=Dallas`
- `POST /api/routes/` body: `origin{lat,lon,label}`, `destination{...}`, `departure` (ISO 8601), `load_lb`, `interval_miles` (10, 25 or 50)
- `POST /api/heatmap/` same body (`interval_miles` ignored)

## Map
The selected route is coloured stretch by stretch by risk (each checkpoint colours the ground halfway to its neighbours, matching the Severe/High mile totals). Other routes are drawn in a muted identity colour; click one to select it. Checkpoint dots open a popup with ETA and weather. Route and checkpoint times are shown in the browser's local time zone.

## Backend setup
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add MAPBOX_TOKEN
python manage.py test
python manage.py runserver
```

## Frontend setup
```bash
cd frontend
npm install
cp .env.example .env        # set VITE_MAPBOX_TOKEN (public pk. token) and VITE_API_URL
npm run dev                 # http://localhost:5173
npm test                    # geometry tests
npm run build
```

## Tests
`python manage.py test` (64 backend tests: risk rules, boundaries, ETA sampling, weather batching/caching, ranking, heatmap) and `npm test` in `frontend/`.

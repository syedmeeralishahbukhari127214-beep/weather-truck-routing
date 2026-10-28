import RiskBadge from "../common/RiskBadge";
import { ROUTE_COLORS } from "../../utils/riskColors";
import { formatDuration, formatMiles } from "../../utils/format";

export default function RouteList({ routes, selectedId, onSelect, reason }) {
  const ordered = [...routes].sort((a, b) => a.rank - b.rank);
  return (
    <section aria-labelledby="routes-heading" className="rounded-2xl border border-[#d3dbd9] bg-white p-5 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="routes-heading" className="text-lg font-bold text-[#12262e]">Routes</h2>
        {reason && <p className="text-sm text-[#4a5f67]">{reason}</p>}
      </div>
      <ul className="space-y-3">
        {ordered.map((r) => {
          const n = routes.indexOf(r);
          const selected = r.id === selectedId;
          const routeColor = ROUTE_COLORS[n % ROUTE_COLORS.length];
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onSelect(r.id)}
                className={`w-full rounded-xl border p-4 text-left transition ${selected ? "border-emerald-500/60 bg-[#f0f7f8] shadow-md" : "border-[#aab8b5] bg-white hover:border-[#aab8b5]"}`}
                style={{ borderLeftWidth: "6px", borderLeftColor: routeColor }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-[#12262e]">Route {n + 1}</span>
                    {r.recommended && <span className="rounded-full bg-[#0b5d6b] px-2.5 py-0.5 text-xs font-bold text-white">Recommended</span>}
                  </div>
                  <RiskBadge level={r.stats.worst_risk} />
                </div>
                <p className="mt-1 text-sm text-[#4a5f67]">{r.summary}</p>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                  <div><dt className="text-[#4a5f67]">Distance</dt><dd className="font-semibold text-[#12262e]">{formatMiles(r.distance_miles)}</dd></div>
                  <div><dt className="text-[#4a5f67]">Drive time</dt><dd className="font-semibold text-[#12262e]">{formatDuration(r.duration_hours)}</dd></div>
                  {r.stats.no_travel_miles > 0 && (
                    <div><dt className="text-[#b3261e]">No Travel</dt><dd className="font-semibold text-[#b3261e]">{formatMiles(r.stats.no_travel_miles)}</dd></div>
                  )}
                  <div><dt className="text-[#4a5f67]">Severe</dt><dd className="font-semibold text-[#12262e]">{formatMiles(r.stats.severe_miles)}</dd></div>
                  <div><dt className="text-[#4a5f67]">High</dt><dd className="font-semibold text-[#12262e]">{formatMiles(r.stats.high_miles)}</dd></div>
                  <div><dt className="text-[#4a5f67]">Avg risk</dt><dd className="font-semibold text-[#12262e]">{r.stats.avg_risk.toFixed(2)} of 4</dd></div>
                </dl>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}


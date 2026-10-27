import { riskFor } from "../../utils/riskColors";
import { formatDuration } from "../../utils/format";

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card/90 to-surface/80 p-4">
      <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-accent/10 blur-3xl" />
      <p className="text-xs uppercase tracking-[0.3em] text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      {accent && <div className="mt-3 h-1 w-10 rounded-full bg-gradient-to-r from-accent to-accent2" />}
    </div>
  );
}

function RouteCard({ route, isRecommended, isSelected, onSelect }) {
  const worst = route.stats?.worst_risk ? route.stats.worst_risk.replace("_", " ") : "Low";
  const worstColor = riskFor(route.stats?.worst_risk || "LOW").color;

  return (
    <button
      type="button"
      onClick={() => onSelect(route.id)}
      className={`flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition ${isSelected ? "border-accent/80 bg-gradient-to-br from-accent/10 to-transparent shadow-glow" : "border-border/80 bg-card/80 hover:border-accent/40"}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted">{route.summary}</p>
          <p className="mt-1 text-lg font-semibold text-white">{isRecommended ? "Route 1 (Recommended)" : `Route ${route.rank}`}</p>
        </div>
        {isRecommended && <span className="rounded-full bg-gradient-to-r from-accent to-accent2 px-3 py-1 text-xs font-semibold text-slate-950">Recommended</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-muted">Distance</p>
          <p className="mt-1 font-semibold text-white">{route.distance_miles} mi</p>
        </div>
        <div>
          <p className="text-muted">Drive Time</p>
          <p className="mt-1 font-semibold text-white">{formatDuration(route.duration_hours * 3600)}</p>
        </div>
        <div>
          <p className="text-muted">Severe Risk</p>
          <p className="mt-1 font-semibold text-white">{route.stats?.severe_miles ?? 0} mi</p>
        </div>
        <div>
          <p className="text-muted">Avg Risk</p>
          <p className="mt-1 font-semibold text-white">{route.stats?.avg_risk ?? 0}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: worstColor }} />
        Worst risk: {worst}
      </div>
    </button>
  );
}

export default function ResultsGrid({ routes, selectedId, onSelect, recommendationReason }) {
  if (!routes?.length) return null;

  const route = routes.find((r) => r.id === selectedId) || routes[0];
  const worst = route.stats?.worst_risk ? route.stats.worst_risk.replace("_", " ") : "Low";
  const worstColor = riskFor(route.stats?.worst_risk || "LOW").color;

  return (
    <section className="mx-auto mt-6 w-full max-w-[1600px] px-6 pb-12 lg:px-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-muted">Route Comparison</p>
          <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">Results & Analytics</h2>
        </div>
        {recommendationReason && <p className="rounded-full border border-border/80 px-4 py-1 text-sm text-muted">{recommendationReason}</p>}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-3">
          {routes.map((r) => (
            <RouteCard key={r.id} route={r} isRecommended={r.recommended} isSelected={r.id === selectedId} onSelect={onSelect} />
          ))}
        </div>
        <div className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-card/80 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-muted">Detailed View</p>
              <p className="mt-1 text-lg font-semibold text-white">Route Details</p>
            </div>
            <div className="flex rounded-full border border-border/80 p-1 text-sm">
              <button className="rounded-full bg-gradient-to-r from-accent to-accent2 px-3 py-1 text-slate-950">Route Details</button>
              <button className="px-3 py-1 text-muted">Vehicle Info</button>
              <button className="px-3 py-1 text-muted">Weather Timeline</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-border/80 bg-surface/80 p-3">
              <p className="text-muted">Route ID</p>
              <p className="mt-1 font-semibold text-white">{route.id}</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-surface/80 p-3">
              <p className="text-muted">Summary</p>
              <p className="mt-1 font-semibold text-white">{route.summary}</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-surface/80 p-3">
              <p className="text-muted">Checkpoints</p>
              <p className="mt-1 font-semibold text-white">{route.checkpoints?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-border/80 bg-surface/80 p-3">
              <p className="text-muted">High / Severe</p>
              <p className="mt-1 font-semibold text-white">{route.stats?.high_miles ?? 0} mi / {route.stats?.severe_miles ?? 0} mi</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <StatCard label="Overall Distance" value={`${route.distance_miles} mi`} sub="Planned route distance" accent />
          <StatCard label="Drive Time" value={formatDuration(route.duration_hours * 3600)} sub="Estimated travel time" accent />
          <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card/90 to-surface/80 p-4">
            <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-warning/10 blur-3xl" />
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Weather Risk Level</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: worstColor }} />
              <p className="text-2xl font-semibold text-white">{worst}</p>
            </div>
            <p className="mt-1 text-sm text-muted">Worst segment risk on route</p>
            <div className="mt-3 h-1 w-10 rounded-full bg-gradient-to-r from-accent to-accent2" />
          </div>
          <StatCard label="Avg Risk Score" value={route.stats?.avg_risk ?? 0} sub="Mile-weighted average" accent />
        </div>
      </div>
    </section>
  );
}



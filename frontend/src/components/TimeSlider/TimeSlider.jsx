import { useMemo } from "react";
import { RISK_LEVELS } from "../../utils/riskColors";

const hourFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

export default function TimeSlider({ hours, worstByHour, value, onChange, showHeat, onToggleHeat, status, error }) {
  const trackBackground = useMemo(() => {
    if (!worstByHour?.length) return undefined;
    const last = worstByHour.length - 1;
    const stops = worstByHour.map((w, i) => {
      const from = Math.max(0, ((i - 0.5) / last) * 100);
      const to = Math.min(100, ((i + 0.5) / last) * 100);
      const c = RISK_LEVELS[w].color;
      return `${c} ${from}%, ${c} ${to}%`;
    });
    return `linear-gradient(to right, ${stops.join(", ")})`;
  }, [worstByHour]);

  const ready = status === "ready" && hours?.length;
  const worst = ready ? RISK_LEVELS[worstByHour[value]] : null;
  const timeLabel = ready ? hourFormat.format(new Date(hours[value])) : "";

  return (
    <section className="rounded-2xl border border-[#d3dbd9] bg-white p-4 shadow-lg" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">
            {ready ? (value === 0 ? "At departure" : `+${value} h`) : "Weather forecast"}
          </p>
          {ready && <p className="text-xs text-[#4a5f67]">{timeLabel}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs text-[#4a5f67]">
          {ready && (
            <span className="flex items-center gap-2">
              Worst on corridor:
              <span className="h-2 w-2 rounded-full" style={{ background: worst.color }} aria-hidden="true" />
              {worst.label}
            </span>
          )}
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={showHeat} onChange={(e) => onToggleHeat(e.target.checked)} className="h-4 w-4 rounded border-[#aab8b5] bg-slate-800 text-emerald-500 focus:ring-emerald-500/40" />
            Heatmap
          </label>
        </div>
      </div>

      {status === "loading" && <p className="mt-2 text-xs text-[#4a5f67]">Loading the 48-hour forecast…</p>}
      {status === "error" && <p className="mt-2 text-xs text-[#b3261e]" role="alert">Forecast unavailable: {error}</p>}
      {status === "idle" && <p className="mt-2 text-xs text-[#4a5f67]">Search a trip to see how the weather changes over the next 48 hours.</p>}

      {ready && (
        <>
          <input
            className="mt-3 w-full accent-[#0b5d6b]"
            type="range"
            min="0"
            max={hours.length - 1}
            step="1"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            style={{ background: trackBackground }}
            aria-label="Hours after departure"
            aria-valuetext={`${value} hours after departure, ${timeLabel}, worst risk ${worst.label}`}
          />
          <div className="mt-1 flex justify-between text-xs text-[#4a5f67]" aria-hidden="true">
            <span>Departure</span>
            <span>+24 h</span>
            <span>+48 h</span>
          </div>
        </>
      )}

      <ul className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#4a5f67]" aria-label="Risk colours">
        {RISK_LEVELS.map((l) => (
          <li key={l.key} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: l.color }} aria-hidden="true" />
            {l.label}
          </li>
        ))}
      </ul>
    </section>
  );
}


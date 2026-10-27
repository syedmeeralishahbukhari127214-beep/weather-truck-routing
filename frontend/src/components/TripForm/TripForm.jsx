import { useState } from "react";
import { defaultDeparture } from "../../utils/format";
import PlaceInput from "./PlaceInput";

const INTERVALS = [10, 25, 50];
const MAX_LOAD_LB = 200000;

const LocationIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const NavigationIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="3 11 22 2 13 21 11 13 3 11" />
  </svg>
);

const CalendarIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const WeightIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18" />
    <path d="M5 6h14" />
    <path d="M7 6l-2 6a4 4 0 0 0 4 0l-2-6" />
    <path d="M17 6l-2 6a4 4 0 0 0 4 0l-2-6" />
  </svg>
);

const SlidersIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

export default function TripForm({ onSubmit, loading }) {
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [departure, setDeparture] = useState(defaultDeparture);
  const [load, setLoad] = useState("40000");
  const [interval, setInterval] = useState(25);
  const [errors, setErrors] = useState({});

  function validate() {
    const e = {};
    if (!origin) e.origin = "Pick a place from the suggestions.";
    if (!destination) e.destination = "Pick a place from the suggestions.";
    if (!departure || Number.isNaN(new Date(departure).getTime())) e.departure = "Enter a departure date and time.";
    const lb = Number(load);
    if (load === "" || !Number.isInteger(lb) || lb < 0 || lb > MAX_LOAD_LB) {
      e.load = `Enter a whole number from 0 to ${MAX_LOAD_LB.toLocaleString()}.`;
    }
    return e;
  }

  function handleSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({
      origin: { label: origin.label, lat: origin.lat, lon: origin.lon },
      destination: { label: destination.label, lat: destination.lat, lon: destination.lon },
      departure: new Date(departure).toISOString(),
      load_lb: Number(load),
      interval_miles: interval,
    });
  }

  return (
    <div className="rounded-2xl border border-[#d3dbd9] bg-white p-5 shadow-lg border-l-4 border-l-emerald-500">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <PlaceInput label="From (Origin)" value={origin} onChange={setOrigin} error={errors.origin} icon={LocationIcon} />
          <PlaceInput label="To (Destination)" value={destination} onChange={setDestination} error={errors.destination} icon={NavigationIcon} />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="departure" className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#4a5f67]">
              <span className="text-[#0b5d6b]">{CalendarIcon}</span>
              Leave at
            </label>
            <div className="relative">
              <input
                id="departure"
                type="datetime-local"
                value={departure}
                onChange={(e) => setDeparture(e.target.value)}
                aria-invalid={Boolean(errors.departure)}
                className="h-11 w-full rounded-lg border border-[#aab8b5] bg-[#f4f7f6] px-3 pl-10 text-sm text-[#12262e] focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#0b5d6b]">
                {CalendarIcon}
              </span>
            </div>
            {errors.departure && <p className="mt-1 text-xs text-[#b3261e]">{errors.departure}</p>}
          </div>

          <div>
            <label htmlFor="load" className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#4a5f67]">
              <span className="text-[#0b5d6b]">{WeightIcon}</span>
              Load (lb)
            </label>
            <div className="relative">
              <input
                id="load"
                type="number"
                inputMode="numeric"
                min="0"
                max={MAX_LOAD_LB}
                step="1"
                value={load}
                onChange={(e) => setLoad(e.target.value)}
                aria-invalid={Boolean(errors.load)}
                className="h-11 w-full rounded-lg border border-[#aab8b5] bg-[#f4f7f6] px-3 pl-10 text-sm text-[#12262e] focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#0b5d6b]">
                {WeightIcon}
              </span>
            </div>
            {errors.load && <p className="mt-1 text-xs text-[#b3261e]">{errors.load}</p>}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[#4a5f67]">Weather interval</p>
          <div className="flex w-full overflow-hidden rounded-lg border border-[#aab8b5] bg-[#f4f7f6]">
            {INTERVALS.map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setInterval(n)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition ${n === interval ? "bg-[#0b5d6b] text-white shadow-md" : "text-[#4a5f67] hover:bg-[#e3eff1] hover:text-white"}`}
              >
                {n} mi
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#0b5d6b] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[#084853] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {SlidersIcon}
            {loading ? "Comparing..." : "Compare Routes & Calculate Risk"}
          </button>
        </div>
      </form>
    </div>
  );
}


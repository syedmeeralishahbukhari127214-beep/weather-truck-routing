import { useState } from "react";
import { defaultDeparture } from "../../utils/format";
import PlaceInput from "./PlaceInput";

const INTERVALS = [10, 25, 50];
const MAX_LOAD_LB = 200000;

export default function TripControlBar({ onSubmit, loading, onMapProviderChange, mapProvider }) {
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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/80 bg-card/80 px-4 py-3 shadow-glow lg:flex-nowrap">
      <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-row lg:items-end">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">From</span>
          <PlaceInput label="From" value={origin} onChange={setOrigin} error={errors.origin} hideLabel />
        </div>
        <div className="flex min-w-[220px] flex-1 flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">To</span>
          <PlaceInput label="To" value={destination} onChange={setDestination} error={errors.destination} hideLabel />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="leave-at" className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Leave at</label>
          <input
            id="leave-at"
            type="datetime-local"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
            className="h-11 rounded-xl border border-border bg-surface/80 px-3 text-sm text-white focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          {errors.departure && <p className="text-xs text-danger">{errors.departure}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="load-lb" className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Load (lb)</label>
          <input
            id="load-lb"
            type="number"
            inputMode="numeric"
            min="0"
            max={MAX_LOAD_LB}
            step="1"
            value={load}
            onChange={(e) => setLoad(e.target.value)}
            className="h-11 w-[140px] rounded-xl border border-border bg-surface/80 px-3 text-sm text-white focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          {errors.load && <p className="text-xs text-danger">{errors.load}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Check every</span>
          <div className="flex overflow-hidden rounded-xl border border-border bg-surface/80">
            {INTERVALS.map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setInterval(n)}
                className={`px-4 py-2 text-sm font-semibold transition ${n === interval ? "bg-gradient-to-r from-accent to-accent2 text-slate-950" : "text-muted hover:text-white"}`}
              >
                {n} mi
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">Map</span>
          <div className="flex overflow-hidden rounded-xl border border-border bg-surface/80">
            <button
              type="button"
              onClick={() => onMapProviderChange?.("mapbox")}
              className={`px-4 py-2 text-sm font-semibold transition ${mapProvider === "mapbox" ? "bg-gradient-to-r from-accent to-acaccent2 text-slate-950" : "text-muted hover:text-white"}`}
            >
              Mapbox
            </button>
            <button
              type="button"
              onClick={() => onMapProviderChange?.("google")}
              className={`px-4 py-2 text-sm font-semibold transition ${mapProvider === "google" ? "bg-gradient-to-r from-accent to-accent2 text-slate-950" : "text-muted hover:text-white"}`}
            >
              Google Maps
            </button>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="h-11 rounded-xl bg-gradient-to-r from-accent to-accent2 px-6 text-sm font-semibold text-slate-950 shadow-glow transition hover:brightness-110 disabled:cursor-not-6xl disabled:opacity-70"
        >
          {loading ? "Comparing..." : "Compare Routes"}
        </button>
      </div>
    </form>
  );
}


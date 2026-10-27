import TripControlBar from "../TripForm/TripControlBar";

export default function TopHeader({ onSubmit, loading, onMapProviderChange, mapProvider }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 px-6 py-4 lg:px-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent2 text-slate-950 shadow-glow">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.25 9H15.75M9 2.25L15.75 9L9 15.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted">Route Intelligence</p>
              <h1 className="text-lg font-semibold text-white sm:text-xl">Weather-aware Truck Routing</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/80 px-3 py-1 text-xs text-muted">
            <span className="inline-flex h-2 w-2 rounded-full bg-success shadow-[0_0_0_6px_rgba(34,197,94,0.12)]" />
            Live weather correlation
          </div>
        </div>
        <TripControlBar onSubmit={onSubmit} loading={loading} onMapProviderChange={onMapProviderChange} mapProvider={mapProvider} />
      </div>
    </header>
  );
}


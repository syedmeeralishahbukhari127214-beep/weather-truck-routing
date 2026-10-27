import { useEffect, useMemo, useState } from "react";
import TripForm from "./components/TripForm/TripForm";
import RouteList from "./components/RouteList/RouteList";
import CheckpointTable from "./components/RouteList/CheckpointTable";
import RouteMap from "./components/Map/RouteMap";
import GoogleRouteMap from "./components/Map/GoogleRouteMap";
import TimeSlider from "./components/TimeSlider/TimeSlider";
import { useTrip } from "./hooks/useTrip";

export default function App() {
  const { trip, heat, run } = useTrip();
  const [selectedId, setSelectedId] = useState(null);
  const [hour, setHour] = useState(0);
  const [showHeat, setShowHeat] = useState(true);
  const [focus, setFocus] = useState(null);
  const [mapProvider, setMapProvider] = useState(() => localStorage.getItem("mapProvider") || "mapbox");

  const routes = trip.data?.routes ?? null;

  // A new result resets the view to the recommended route at departure time.
  useEffect(() => {
    if (!trip.data) return;
    setSelectedId(trip.data.recommended_route_id);
    setHour(0);
    setFocus(null);
  }, [trip.data]);

  // Worst risk anywhere on the corridor, per forecast hour (paints the slider track).
  const worstByHour = useMemo(() => {
    const points = heat.data?.points;
    if (!points?.length) return null;
    return heat.data.hours.map((_, h) => points.reduce((m, p) => Math.max(m, p.risk[h]), 0));
  }, [heat.data]);

  useEffect(() => {
    localStorage.setItem("mapProvider", mapProvider);
  }, [mapProvider]);

  const selectedIndex = routes ? routes.findIndex((r) => r.id === selectedId) : -1;
  const selectedRoute = selectedIndex >= 0 ? routes[selectedIndex] : null;

  return (
    <div className="min-h-screen bg-[#eef1f0] px-4 py-6 text-[#12262e] sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-[#12262e] sm:text-3xl">Weather-aware Truck Routing</h1>
          <p className="text-sm text-[#4a5f67]">Up to three routes ranked by weather risk along the way.</p>
        </header>

        <TripForm onSubmit={run} loading={trip.status === "loading"} />

        {trip.status === "loading" && (
          <p className="text-sm text-[#4a5f67]" role="status">Finding routes and checking the weather along each one…</p>
        )}
        {trip.status === "error" && (
          <p className="rounded-lg border border-[#f1b8b3] bg-[#fdecea] px-4 py-3 text-sm text-[#b3261e]" role="alert">
            {trip.error} Check your details and try again.
          </p>
        )}

        <div className="flex justify-center">
          <div className="inline-flex overflow-hidden rounded-lg border border-[#aab8b5] bg-[#f4f7f6]">
            <button
              type="button"
              onClick={() => setMapProvider("mapbox")}
              className={`px-4 py-2 text-sm font-semibold transition ${mapProvider === "mapbox" ? "bg-[#0b5d6b] text-white" : "text-[#4a5f67] hover:text-white"}`}
            >
              Mapbox
            </button>
            <button
              type="button"
              onClick={() => setMapProvider("google")}
              className={`px-4 py-2 text-sm font-semibold transition ${mapProvider === "google" ? "bg-[#0b5d6b] text-white" : "text-[#4a5f67] hover:text-white"}`}
            >
              Google Maps
            </button>
          </div>
        </div>

        <section className="relative overflow-hidden rounded-2xl border border-[#d3dbd9] bg-white shadow-lg">
          <div className="relative h-[560px] w-full">
            {mapProvider === "google" ? (
              <GoogleRouteMap
                routes={routes}
                selectedId={selectedId}
                onSelectRoute={setSelectedId}
                heat={heat.data}
                hour={hour}
                showHeat={showHeat}
                focus={focus}
              />
            ) : (
              <RouteMap
                routes={routes}
                selectedId={selectedId}
                onSelectRoute={setSelectedId}
                heat={heat.data}
                hour={hour}
                showHeat={showHeat}
                focus={focus}
              />
            )}
          </div>
        </section>

        <TimeSlider
          hours={heat.data?.hours}
          worstByHour={worstByHour}
          value={hour}
          onChange={setHour}
          showHeat={showHeat}
          onToggleHeat={setShowHeat}
          status={heat.status}
          error={heat.error}
        />

        {routes && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RouteList
              routes={routes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              reason={trip.data.recommendation_reason}
            />
            {selectedRoute && (
              <CheckpointTable route={selectedRoute} routeNumber={selectedIndex + 1} onFocus={setFocus} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}


import RouteMap from "../Map/RouteMap";
import GoogleRouteMap from "../Map/GoogleRouteMap";
import MapSwitcher from "../Map/MapSwitcher";

export default function MapCanvas({ routes, selectedId, onSelectRoute, heat, hour, showHeat, focus, mapProvider, onMapProviderChange, children }) {
  return (
    <section className="relative mx-auto w-full max-w-[1600px] px-6 lg:px-10">
      <div className="relative overflow-hidden rounded-3xl border border-border/80 shadow-glow">
        <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2">
          <MapSwitcher provider={mapProvider} onChange={onMapProviderChange} />
        </div>
        <div className="h-[520px] w-full sm:h-[560px] lg:h-[620px]">
          {mapProvider === "google" ? (
            <GoogleRouteMap
              routes={routes}
              selectedId={selectedId}
              onSelectRoute={onSelectRoute}
              heat={heat}
              hour={hour}
              showHeat={showHeat}
              focus={focus}
            />
          ) : (
            <RouteMap
              routes={routes}
              selectedId={selectedId}
              onSelectRoute={onSelectRoute}
              heat={heat}
              hour={hour}
              showHeat={showHeat}
              focus={focus}
            />
          )}
        </div>
        {children}
      </div>
    </section>
  );
}


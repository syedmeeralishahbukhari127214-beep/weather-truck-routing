export default function MapSwitcher({ provider, onChange }) {
  return (
    <div className="map-switcher">
      <span className="map-switcher-label">Map</span>
      <div className="segmented small">
        <label className={provider === "mapbox" ? "on" : ""}>
          <input type="radio" checked={provider === "mapbox"} onChange={() => onChange("mapbox")} />
          Mapbox
        </label>
        <label className={provider === "google" ? "on" : ""}>
          <input type="radio" checked={provider === "google"} onChange={() => onChange("google")} />
          Google Maps
        </label>
      </div>
    </div>
  );
}


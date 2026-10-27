import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import { boundsOf, riskSegments } from "../../utils/geo";
import { ROUTE_COLORS, riskFor } from "../../utils/riskColors";
import { formatEta } from "../../utils/format";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const EMPTY = { type: "FeatureCollection", features: [] };

function popupNode(cp) {
  const root = document.createElement("div");
  root.className = "popup";
  const add = (tag, text, cls) => {
    const el = document.createElement(tag);
    el.textContent = text;
    if (cls) el.className = cls;
    root.appendChild(el);
  };
  add("strong", `Mile ${Math.round(cp.mile_marker)}, ${riskFor(cp.risk.level).label}`);
  add("span", `Arrive ${formatEta(cp.eta)}`);
  add("span", `Wind ${cp.weather.wind_mph} mph`);
  add("span", `Rain ${cp.weather.rain_in_hr} in/h`);
  add("span", `Snow ${cp.weather.snow_in_hr} in/h`);
  return root;
}

export default function RouteMap({ routes, selectedId, onSelectRoute, heat, hour, showHeat, focus }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const pinsRef = useRef([]);
  const [ready, setReady] = useState(false);

  // Keep latest values reachable from map event handlers without re-binding them.
  const onSelectRef = useRef(onSelectRoute);
  onSelectRef.current = onSelectRoute;
  const selectedRouteRef = useRef(null);

  const selectedRoute = routes?.find((r) => r.id === selectedId) ?? null;
  selectedRouteRef.current = selectedRoute;

  // ---- derived GeoJSON (recomputed only when its inputs change) ----
  const riskGeo = useMemo(
    () => (selectedRoute ? riskSegments(selectedRoute, (k) => riskFor(k).color) : EMPTY),
    [selectedRoute]
  );
  const otherRoutesGeo = useMemo(
    () => ({
      type: "FeatureCollection",
      features: (routes ?? [])
        .filter((r) => r.id !== selectedId)
        .map((r) => ({
          type: "Feature",
          properties: { id: r.id, color: ROUTE_COLORS[routes.indexOf(r) % ROUTE_COLORS.length] },
          geometry: { type: "LineString", coordinates: r.geometry },
        })),
    }),
    [routes, selectedId]
  );
  const checkpointsGeo = useMemo(
    () => ({
      type: "FeatureCollection",
      features: (selectedRoute?.checkpoints ?? []).map((c) => ({
        type: "Feature",
        properties: { index: c.index, color: riskFor(c.risk.level).color },
        geometry: { type: "Point", coordinates: [c.lon, c.lat] },
      })),
    }),
    [selectedRoute]
  );

  // ---- create the map once ----
  useEffect(() => {
    if (!TOKEN || !containerRef.current) return undefined;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-98.5, 39.5],
      zoom: 3.4,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      // Heatmap first so everything else draws on top of it.
      map.addSource("heat", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "heat",
        type: "heatmap",
        source: "heat",
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "risk"], 0, 0, 1, 0.3, 2, 0.6, 3, 0.85, 4, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.9, 9, 1.8],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 18, 6, 46, 9, 95, 12, 170],
          "heatmap-opacity": 0.85,
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0, "rgba(255,255,255,0)",
            0.15, "rgba(227,181,5,0.55)",
            0.4, "rgba(238,123,26,0.75)",
            0.7, "rgba(198,40,40,0.85)",
            1, "rgba(27,27,31,0.92)",
          ],
        },
      });

      map.addSource("routes", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "routes-hit", type: "line", source: "routes",
        paint: { "line-color": "#000", "line-opacity": 0, "line-width": 18 },
      });
      map.addLayer({
        id: "routes-line", type: "line", source: "routes",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 4, "line-opacity": 0.6 },
      });

      map.addSource("risk", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "risk-casing", type: "line", source: "risk",
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: { "line-color": "#ffffff", "line-width": 10 },
      });
      map.addLayer({
        id: "risk-line", type: "line", source: "risk",
        layout: { "line-cap": "butt", "line-join": "round" },
        paint: { "line-color": ["get", "color"], "line-width": 6 },
      });

      map.addSource("checkpoints", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "checkpoints", type: "circle", source: "checkpoints",
        paint: {
          "circle-radius": 5.5,
          "circle-color": ["get", "color"],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      const pointer = (on) => () => { map.getCanvas().style.cursor = on ? "pointer" : ""; };
      ["routes-hit", "checkpoints"].forEach((id) => {
        map.on("mouseenter", id, pointer(true));
        map.on("mouseleave", id, pointer(false));
      });
      map.on("click", "routes-hit", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) onSelectRef.current?.(id);
      });
      map.on("click", "checkpoints", (e) => {
        const idx = e.features?.[0]?.properties?.index;
        const cp = selectedRouteRef.current?.checkpoints.find((c) => c.index === idx);
        if (!cp) return;
        popupRef.current?.remove();
        popupRef.current = new mapboxgl.Popup({ offset: 12 })
          .setLngLat([cp.lon, cp.lat])
          .setDOMContent(popupNode(cp))
          .addTo(map);
      });
      setReady(true);
    });

    return () => {
      setReady(false);
      popupRef.current?.remove();
      pinsRef.current.forEach((p) => p.remove());
      pinsRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ---- push route data ----
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    map.getSource("routes").setData(otherRoutesGeo);
    map.getSource("risk").setData(riskGeo);
    map.getSource("checkpoints").setData(checkpointsGeo);
  }, [ready, otherRoutesGeo, riskGeo, checkpointsGeo]);

  // ---- new search: frame all routes and drop A/B pins ----
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    pinsRef.current.forEach((p) => p.remove());
    pinsRef.current = [];
    popupRef.current?.remove();
    if (!routes?.length) return;
    map.fitBounds(boundsOf(routes), { padding: { top: 60, left: 60, right: 60, bottom: 230 }, maxZoom: 11, duration: 800 });
    const geometry = routes[0].geometry;
    [["A", geometry[0]], ["B", geometry[geometry.length - 1]]].forEach(([letter, lngLat]) => {
      const el = document.createElement("div");
      el.className = "pin";
      el.textContent = letter;
      pinsRef.current.push(new mapboxgl.Marker({ element: el }).setLngLat(lngLat).addTo(map));
    });
  }, [ready, routes]);

  // ---- heatmap: whole 48 h dataset is already in memory, so the slider only swaps one number per point ----
  useEffect(() => {
    if (!ready) return undefined;
    const frame = requestAnimationFrame(() => {
      const features = (heat?.points ?? []).map((p) => ({
        type: "Feature",
        properties: { risk: p.risk[hour] ?? 0 },
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      }));
      mapRef.current?.getSource("heat")?.setData({ type: "FeatureCollection", features });
    });
    return () => cancelAnimationFrame(frame);
  }, [ready, heat, hour]);

  useEffect(() => {
    if (!ready) return;
    mapRef.current.setLayoutProperty("heat", "visibility", showHeat ? "visible" : "none");
  }, [ready, showHeat]);

  // ---- "find on map" from the checkpoint table ----
  useEffect(() => {
    if (!ready || !focus) return;
    const map = mapRef.current;
    map.flyTo({ center: [focus.lon, focus.lat], zoom: Math.max(map.getZoom(), 8), duration: 700 });
    popupRef.current?.remove();
    popupRef.current = new mapboxgl.Popup({ offset: 12 })
      .setLngLat([focus.lon, focus.lat])
      .setDOMContent(popupNode(focus))
      .addTo(map);
  }, [ready, focus]);

  function openInGoogleMaps() {
    if (!selectedRoute?.geometry?.length) return;
    const coords = selectedRoute.geometry;
    const [startLng, startLat] = coords[0];
    const [endLng, endLat] = coords[coords.length - 1];
    const url = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${endLat},${endLng}&travelmode=driving`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!TOKEN) {
    return (
      <div className="map-missing" role="alert">
        <strong>Map unavailable</strong>
        <p>Add VITE_MAPBOX_TOKEN to frontend/.env and restart the dev server.</p>
      </div>
    );
  }
  return (
    <>
      <div ref={containerRef} className="map" />
      {selectedRoute && (
        <button type="button" className="gmaps-open-btn" onClick={openInGoogleMaps}>
          Open route in Google Maps ↗
        </button>
      )}
    </>
  );
}


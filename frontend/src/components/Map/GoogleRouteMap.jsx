import { useEffect, useRef, useState } from "react";
import { boundsOf } from "../../utils/geo";
import { riskFor } from "../../utils/riskColors";
import { formatEta } from "../../utils/format";

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function popupContent(cp) {
  const div = document.createElement("div");
  div.className = "g-popup";
  div.innerHTML = `
    <strong>Mile ${Math.round(cp.mile_marker)}, ${riskFor(cp.risk.level).label}</strong>
    <span>Arrive ${formatEta(cp.eta)}</span>
    <span>Wind ${cp.weather.wind_mph} mph</span>
    <span>Rain ${cp.weather.rain_in_hr} in/h</span>
    <span>Snow ${cp.weather.snow_in_hr} in/h</span>
  `;
  return div;
}

let loaderPromise = null;
function loadGoogleMaps() {
  if (window.google && window.google.maps) return Promise.resolve();
  if (loaderPromise) return loaderPromise;
  loaderPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
  return loaderPromise;
}

export default function GoogleRouteMap({ routes, selectedId, onSelectRoute, heat, hour, showHeat, focus }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const polylinesRef = useRef({ other: [], risk: [] });
  const markersRef = useRef({ checkpoints: [], pins: [] });
  const heatCirclesRef = useRef([]);
  const infoRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const selectedRoute = routes?.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (!API_KEY || API_KEY.startsWith("AIzaSyDummy")) {
      setLoadError("Add a valid VITE_GOOGLE_MAPS_API_KEY to frontend/.env");
      return;
    }
    if (!containerRef.current || mapRef.current) return;

    loadGoogleMaps()
      .then(() => {
        const map = new google.maps.Map(containerRef.current, {
          center: { lat: 39.5, lng: -98.5 },
          zoom: 3.4,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        });
        mapRef.current = map;
        infoRef.current = new google.maps.InfoWindow();
        setReady(true);
      })
      .catch((err) => {
        setLoadError(err?.message || "Failed to load Google Maps");
      });
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    polylinesRef.current.other.forEach((p) => p.setMap(null));
    polylinesRef.current.risk.forEach((p) => p.setMap(null));
    polylinesRef.current.other = [];
    polylinesRef.current.risk = [];

    if (routes) {
      routes
        .filter((r) => r.id !== selectedId)
        .forEach((r, idx) => {
          const colors = ["#64748b", "#94a3b8", "#cbd5e1"];
          const poly = new google.maps.Polyline({
            path: r.geometry.map(([lng, lat]) => ({ lat, lng })),
            strokeColor: colors[idx % colors.length],
            strokeOpacity: 0.6,
            strokeWeight: 4,
            map: mapRef.current,
            clickable: true,
          });
          poly.addListener("click", () => onSelectRoute?.(r.id));
          polylinesRef.current.other.push(poly);
        });
    }

    if (selectedRoute) {
      let i = 0;
      const cps = selectedRoute.checkpoints;
      while (i < cps.length) {
        const cp = cps[i];
        const j = Math.min(cps.length - 1, i + 1);
        const next = cps[j];
        const path = [
          { lat: cp.lat, lng: cp.lon },
          { lat: next.lat, lng: next.lon },
        ];
        const color = riskFor(cp.risk.level).color;
        const casing = new google.maps.Polyline({
          path,
          strokeColor: "#ffffff",
          strokeOpacity: 0.9,
          strokeWeight: 10,
          map: mapRef.current,
        });
        const poly = new google.maps.Polyline({
          path,
          strokeColor: color,
          strokeOpacity: 1,
          strokeWeight: 6,
          map: mapRef.current,
        });
        polylinesRef.current.risk.push(casing, poly);
        i += 1;
      }
    }
  }, [ready, routes, selectedId, selectedRoute, onSelectRoute]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    markersRef.current.checkpoints.forEach((m) => m.setMap(null));
    markersRef.current.checkpoints = [];

    if (selectedRoute) {
      selectedRoute.checkpoints.forEach((cp) => {
        const marker = new google.maps.Marker({
          position: { lat: cp.lat, lng: cp.lon },
          map: mapRef.current,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 6,
            fillColor: riskFor(cp.risk.level).color,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });
        marker.addListener("click", () => {
          if (infoRef.current) {
            infoRef.current.setContent(popupContent(cp));
            infoRef.current.open({ map: mapRef.current, anchor: marker });
          }
        });
        markersRef.current.checkpoints.push(marker);
      });
    }
  }, [ready, selectedRoute]);

  useEffect(() => {
    if (!ready || !mapRef.current || !routes?.length) return;
    markersRef.current.pins.forEach((m) => m.setMap(null));
    markersRef.current.pins = [];

    const bounds = new google.maps.LatLngBounds();
    routes.forEach((r) => {
      r.geometry.forEach(([lng, lat]) => bounds.extend({ lat, lng }));
    });
    mapRef.current.fitBounds(bounds, 80);

    const geometry = routes[0].geometry;
    [["A", geometry[0]], ["B", geometry[geometry.length - 1]]].forEach(([letter, [lng, lat]]) => {
      const marker = new google.maps.Marker({
        position: { lat, lng },
        map: mapRef.current,
        label: { text: letter, color: "#ffffff", fontWeight: "800" },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: "#12262e",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      markersRef.current.pins.push(marker);
    });
  }, [ready, routes]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    heatCirclesRef.current.forEach((c) => c.setMap(null));
    heatCirclesRef.current = [];
    if (!showHeat || !heat?.points?.length) return;

    heat.points.forEach((p) => {
      const risk = p.risk?.[hour] ?? 0;
      if (risk < 0.5) return;
      const colors = ["rgba(227,181,5,0.4)", "rgba(238,123,26,0.5)", "rgba(198,40,40,0.6)", "rgba(27,27,31,0.7)"];
      const circle = new google.maps.Circle({
        center: { lat: p.lat, lng: p.lon },
        radius: 2500 + risk * 2000,
        strokeWeight: 0,
        fillColor: colors[Math.min(3, Math.floor(risk))] || colors[0],
        fillOpacity: 0.5,
        map: mapRef.current,
      });
      heatCirclesRef.current.push(circle);
    });
  }, [ready, heat, hour, showHeat]);

  useEffect(() => {
    if (!ready || !mapRef.current || !focus) return;
    mapRef.current.panTo({ lat: focus.lat, lng: focus.lon });
    mapRef.current.setZoom(Math.max(mapRef.current.getZoom() || 8, 9));
    if (infoRef.current) {
      infoRef.current.setContent(popupContent(focus));
      infoRef.current.open({ map: mapRef.current, position: { lat: focus.lat, lng: focus.lon } });
    }
  }, [ready, focus]);

  function openInGoogleMaps() {
    if (!selectedRoute?.geometry?.length) return;
    const coords = selectedRoute.geometry;
    const [startLng, startLat] = coords[0];
    const [endLng, endLat] = coords[coords.length - 1];
    const url = `https://www.google.com/maps/dir/?api=1&origin=${startLat},${startLng}&destination=${endLat},${endLng}&travelmode=driving`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (loadError) {
    return (
      <div className="map-missing" role="alert">
        <strong>Google Maps unavailable</strong>
        <p>{loadError}</p>
      </div>
    );
  }
  if (!API_KEY || API_KEY.startsWith("AIzaSyDummy")) {
    return (
      <div className="map-missing" role="alert">
        <strong>Google Maps unavailable</strong>
        <p>Add VITE_GOOGLE_MAPS_API_KEY to frontend/.env</p>
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


import { useCallback, useRef, useState } from "react";
import { fetchHeatmap, fetchRoutes } from "../api/client";

const IDLE = { status: "idle", data: null, error: null };

/**
 * Runs a trip search: routes first (shown as soon as they arrive), then the
 * 48-hour heatmap, which reuses the backend's cached routes.
 */
export function useTrip() {
  const [trip, setTrip] = useState(IDLE);
  const [heat, setHeat] = useState(IDLE);
  const abortRef = useRef(null);

  const run = useCallback(async (payload) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setTrip({ status: "loading", data: null, error: null });
    setHeat(IDLE);

    try {
      const data = await fetchRoutes(payload, ctrl.signal);
      setTrip({ status: "ready", data, error: null });
    } catch (err) {
      if (err.name !== "AbortError") setTrip({ status: "error", data: null, error: err.message });
      return;
    }

    setHeat({ status: "loading", data: null, error: null });
    try {
      const data = await fetchHeatmap(payload, ctrl.signal);
      setHeat({ status: "ready", data, error: null });
    } catch (err) {
      if (err.name !== "AbortError") setHeat({ status: "error", data: null, error: err.message });
    }
  }, []);

  return { trip, heat, run };
}

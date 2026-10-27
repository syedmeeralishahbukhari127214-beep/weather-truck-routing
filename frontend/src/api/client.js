const BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {}

function messageFrom(data) {
  if (!data) return null;
  if (typeof data.error === "string") return data.error;
  // DRF validation errors: { field: ["message"] }
  const first = Object.entries(data)[0];
  if (first) {
    const [field, msgs] = first;
    const text = Array.isArray(msgs) ? msgs[0] : JSON.stringify(msgs);
    return `${field.replace(/_/g, " ")}: ${text}`;
  }
  return null;
}

async function request(path, { method = "GET", body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new ApiError("Cannot reach the server. Check that the backend is running.");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(messageFrom(data) || `Request failed (${res.status})`);
  return data;
}

export const geocode = (q, signal) => request(`/api/geocode/?q=${encodeURIComponent(q)}`, { signal });
export const fetchRoutes = (payload, signal) => request("/api/routes/", { method: "POST", body: payload, signal });
export const fetchHeatmap = (payload, signal) => request("/api/heatmap/", { method: "POST", body: payload, signal });

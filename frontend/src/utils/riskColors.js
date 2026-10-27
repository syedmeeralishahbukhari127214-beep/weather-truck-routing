// Index matches the backend's RiskLevel values (0..4).
export const RISK_LEVELS = [
  { key: "LOW", label: "Low", color: "#2f9e5b" },
  { key: "MODERATE", label: "Moderate", color: "#e3b505" },
  { key: "HIGH", label: "High", color: "#ee7b1a" },
  { key: "SEVERE", label: "Severe", color: "#c62828" },
  { key: "NO_TRAVEL", label: "No Travel", color: "#1b1b1f" },
];

export const riskIndex = (key) => RISK_LEVELS.findIndex((l) => l.key === key);
export const riskFor = (keyOrIndex) =>
  typeof keyOrIndex === "number" ? RISK_LEVELS[keyOrIndex] : RISK_LEVELS[riskIndex(keyOrIndex)];

// Route identity colours: deliberately different from the risk palette.
export const ROUTE_COLORS = ["#2563eb", "#0891b2", "#9333ea"];

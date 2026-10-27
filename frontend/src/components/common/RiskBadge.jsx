import { riskFor } from "../../utils/riskColors";

export default function RiskBadge({ level }) {
  const risk = riskFor(level);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#aab8b5] bg-[#f4f7f6] px-2.5 py-0.5 text-xs font-semibold text-[#12262e]">
      <span className="h-2 w-2 rounded-full" style={{ background: risk.color }} aria-hidden="true" />
      {risk.label}
    </span>
  );
}


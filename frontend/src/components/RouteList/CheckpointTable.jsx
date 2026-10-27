import RiskBadge from "../common/RiskBadge";
import { formatEta } from "../../utils/format";

export default function CheckpointTable({ route, routeNumber, onFocus }) {
  return (
    <section aria-labelledby="cp-heading" className="rounded-2xl border border-[#d3dbd9] bg-white p-5 shadow-lg">
      <div className="mb-3">
        <h2 id="cp-heading" className="text-lg font-bold text-white">Checkpoints on route {routeNumber}</h2>
        <p className="mt-1 text-sm text-[#4a5f67]">Times are in your local time zone. Select a mile marker to find it on the map.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#aab8b5]">
        <table className="w-full text-sm">
          <thead className="bg-[#f4f7f6]">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-semibold text-[#4a5f67]">Mile</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold text-[#4a5f67]">Arrive</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold text-[#4a5f67]">Wind</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold text-[#4a5f67]">Rain</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold text-[#4a5f67]">Snow</th>
              <th scope="col" className="px-3 py-2 text-left font-semibold text-[#4a5f67]">Risk</th>
            </tr>
          </thead>
          <tbody>
            {route.checkpoints.map((c) => (
              <tr key={c.index} className="border-t border-[#aab8b5]/60 hover:bg-[#e3eff1]/40">
                <th scope="row" className="px-3 py-2 font-semibold text-[#12262e]">
                  <button type="button" onClick={() => onFocus(c)} className="text-[#0b5d6b] hover:text-[#084853] hover:underline">
                    {Math.round(c.mile_marker)}
                  </button>
                </th>
                <td className="px-3 py-2 text-[#4a5f67]">{formatEta(c.eta)}</td>
                <td className="px-3 py-2 text-[#4a5f67]">{c.weather.wind_mph} mph</td>
                <td className="px-3 py-2 text-[#4a5f67]">{c.weather.rain_in_hr} in/h</td>
                <td className="px-3 py-2 text-[#4a5f67]">{c.weather.snow_in_hr} in/h</td>
                <td className="px-3 py-2"><RiskBadge level={c.risk.level} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}


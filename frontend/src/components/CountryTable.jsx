import { useMemo, useState } from "react";
import { Input } from "./ui/input";
import { Search } from "lucide-react";

const zoneBadge = (z) => {
  const colors = {
    1: "bg-emerald-50 text-emerald-700 border-emerald-200",
    2: "bg-emerald-50 text-emerald-700 border-emerald-200",
    3: "bg-sky-50 text-sky-700 border-sky-200",
    4: "bg-sky-50 text-sky-700 border-sky-200",
    5: "bg-sky-50 text-sky-700 border-sky-200",
    6: "bg-indigo-50 text-indigo-700 border-indigo-200",
    7: "bg-indigo-50 text-indigo-700 border-indigo-200",
    8: "bg-indigo-50 text-indigo-700 border-indigo-200",
    9: "bg-amber-50 text-amber-700 border-amber-200",
    10: "bg-amber-50 text-amber-700 border-amber-200",
    11: "bg-rose-50 text-rose-700 border-rose-200",
    12: "bg-rose-50 text-rose-700 border-rose-200",
    13: "bg-rose-50 text-rose-700 border-rose-200",
    14: "bg-slate-100 text-slate-800 border-slate-300",
  };
  return colors[z] || "bg-slate-100 text-slate-700 border-slate-300";
};

export default function CountryTable({ countries }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return countries;
    return countries.filter(
      (c) => c.name.toLowerCase().includes(t) || c.code.toLowerCase().includes(t)
    );
  }, [q, countries]);

  return (
    <div className="border border-slate-200 rounded-sm bg-white" data-testid="country-table">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs tracking-[0.25em] uppercase text-slate-500">Reference</div>
          <div className="font-display text-lg text-slate-900">Country → Zone Mapping</div>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search country or code"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-9 rounded-sm border-slate-300"
            data-testid="country-search-input"
          />
        </div>
      </div>
      <div className="max-h-[520px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-2.5 text-[10px] tracking-wider uppercase text-slate-500 font-medium">Country</th>
              <th className="text-left px-4 py-2.5 text-[10px] tracking-wider uppercase text-slate-500 font-medium w-20">Code</th>
              <th className="text-right px-4 py-2.5 text-[10px] tracking-wider uppercase text-slate-500 font-medium w-28">Zone</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.code} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2 text-slate-900">{c.name}</td>
                <td className="px-4 py-2 font-mono text-slate-500 text-xs">{c.code}</td>
                <td className="px-4 py-2 text-right">
                  <span className={`inline-flex items-center justify-center min-w-[48px] px-2 py-0.5 text-xs font-mono border rounded-sm ${zoneBadge(c.zone)}`}>
                    Z{c.zone}
                  </span>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-12 text-slate-400 text-sm">
                  No countries match "{q}"
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-3 border-t border-slate-200 text-xs text-slate-500 font-mono">
        {filtered.length} / {countries.length} countries
      </div>
    </div>
  );
}

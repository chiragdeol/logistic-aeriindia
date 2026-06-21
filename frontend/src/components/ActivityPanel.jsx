import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { Search, Plane, Activity as ActivityIcon, User } from "lucide-react";

const fmt = (n) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

export default function ActivityPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [carrierFilter, setCarrierFilter] = useState("all");

  useEffect(() => {
    api
      .get("/activity")
      .then((r) => setItems(r.data))
      .catch(() => toast.error("Failed to load activity"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = items.filter((it) => {
    if (carrierFilter !== "all" && it.carrier !== carrierFilter) return false;
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      return (
        it.user_email.toLowerCase().includes(t) ||
        (it.customer_name || "").toLowerCase().includes(t) ||
        it.country_name.toLowerCase().includes(t) ||
        String(it.weight_kg).includes(t)
      );
    }
    return true;
  });

  const stats = {
    total: items.length,
    dhl: items.filter((i) => i.carrier === "dhl").length,
    fedex: items.filter((i) => i.carrier === "fedex").length,
    revenue: items.reduce((sum, i) => sum + i.total, 0),
  };

  return (
    <div className="space-y-5" data-testid="activity-panel">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Total quotes" value={stats.total.toString()} icon={<ActivityIcon className="w-4 h-4" />} />
        <Card label="DHL quotes" value={stats.dhl.toString()} accent="bg-yellow-50 border-yellow-300 text-yellow-900" />
        <Card label="FedEx quotes" value={stats.fedex.toString()} accent="bg-purple-50 border-purple-300 text-purple-900" />
        <Card label="Quoted total" value={fmt(stats.revenue)} accent="bg-slate-900 border-slate-900 text-white" />
      </div>

      <div className="border border-slate-200 rounded-sm bg-white">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs tracking-[0.25em] uppercase text-slate-500">User activity</div>
            <div className="font-display text-lg text-slate-900">Recent quotes</div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex border border-slate-300 rounded-sm overflow-hidden text-xs">
              {["all", "dhl", "fedex"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCarrierFilter(c)}
                  className={`px-3 py-1.5 tracking-wider uppercase ${carrierFilter === c ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  data-testid={`activity-filter-${c}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search user, customer, country…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-9 rounded-sm border-slate-300"
                data-testid="activity-search"
              />
            </div>
          </div>
        </div>

        <div className="max-h-[640px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <Th>Time</Th>
                <Th>User</Th>
                <Th>Customer</Th>
                <Th>Carrier</Th>
                <Th>Country</Th>
                <Th align="right">Weight</Th>
                <Th>Type</Th>
                <Th align="right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-slate-400 text-sm">No activity yet.</td></tr>
              ) : filtered.map((it) => (
                <tr key={it.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors" data-testid={`activity-row-${it.id}`}>
                  <td className="px-4 py-2.5 text-xs text-slate-500 font-mono whitespace-nowrap">{fmtTime(it.timestamp)}</td>
                  <td className="px-4 py-2.5 text-slate-900 text-xs">{it.user_email}</td>
                  <td className="px-4 py-2.5 text-slate-900 font-medium" data-testid="activity-customer">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="w-3 h-3 text-slate-400" />
                      {it.customer_name || <span className="text-slate-400 italic">—</span>}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {it.carrier === "dhl" ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-yellow-400 text-slate-900 rounded-sm">
                        <Plane className="w-2.5 h-2.5" /> DHL
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-purple-700 text-white rounded-sm">FedEx</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {it.country_name}
                    <span className="ml-2 text-[10px] font-mono text-slate-400">Z{it.zone}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-700">{it.chargeable_weight} kg</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500 capitalize">{it.shipment_type || "—"}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-900 whitespace-nowrap">{fmt(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-slate-200 text-xs text-slate-500 font-mono">
          {filtered.length} / {items.length} quotes
        </div>
      </div>
    </div>
  );
}

const Th = ({ children, align = "left" }) => (
  <th className={`px-4 py-2.5 text-[10px] tracking-wider uppercase text-slate-500 font-medium text-${align}`}>{children}</th>
);

const Card = ({ label, value, icon, accent = "bg-white border-slate-200 text-slate-900" }) => (
  <div className={`border rounded-sm p-4 ${accent}`}>
    <div className="flex items-center gap-2 text-[10px] tracking-[0.25em] uppercase opacity-80">
      {icon}
      {label}
    </div>
    <div className="font-mono tabular-nums text-2xl font-semibold mt-2">{value}</div>
  </div>
);

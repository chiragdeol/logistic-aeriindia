import { User, MapPin, Package as PkgIcon, Info } from "lucide-react";

const fmt = (n) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Row = ({ label, value, sub, bold }) => (
  <div className="flex items-baseline justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0">
    <div className="text-[11px] sm:text-xs tracking-wider uppercase text-slate-600 min-w-0">
      <span className="block sm:inline">{label}</span>
      {sub && <span className="ml-0 sm:ml-2 text-[10px] text-slate-400 normal-case tracking-normal block sm:inline">{sub}</span>}
    </div>
    <div className={`font-mono tabular-nums flex-shrink-0 ${bold ? "text-sm sm:text-base font-semibold text-slate-900" : "text-xs sm:text-sm text-slate-700"}`}>
      {value}
    </div>
  </div>
);

export default function FedexBreakdown({ data, customerName }) {
  if (!data) return null;

  return (
    <div className="rounded-md bg-white border border-slate-200 shadow-sm overflow-hidden" data-testid="fedex-breakdown">
      {/* Header strip */}
      <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-purple-700 to-purple-600 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <span className="font-semibold text-sm tracking-wider">FEDEX</span>
        </div>
        <span className="text-[10px] tracking-[0.25em] uppercase text-white/70 font-medium">Quote</span>
      </div>

      {/* Customer + destination */}
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 space-y-2">
        {customerName && (
          <div className="flex items-center gap-2 text-sm text-slate-700" data-testid="fedex-breakdown-customer">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100">
              <User className="w-3 h-3 text-slate-500" />
            </span>
            <span className="font-medium">{customerName}</span>
          </div>
        )}
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 mt-1 text-slate-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg sm:text-xl text-slate-900 leading-tight" data-testid="fedex-breakdown-country">
              {data.country.name}
              <span className="text-slate-400 font-normal ml-2 text-sm">(Zone {data.zone})</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
              <PkgIcon className="w-3 h-3" />
              <span>{data.service === "envelope" ? "Envelope" : "Package"}</span>
              <span>·</span>
              <span>Chargeable {data.chargeable_weight} kg</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Actual {data.actual_weight} kg · Volumetric {data.volumetric_weight} kg
            </div>
          </div>
        </div>
      </div>

      {/* Rate breakdown rows */}
      <div className="px-5 sm:px-6 py-3 space-y-0" data-testid="fedex-breakdown-rows">
        {data.per_kg_mode && (
          <div className="py-2 text-[10px] tracking-[0.2em] uppercase text-purple-700 bg-purple-50 -mx-5 sm:-mx-6 px-5 sm:px-6 border-b border-purple-100 mb-2">
            Per-kg breakdown · all amounts below are per kg
          </div>
        )}
        <Row
          label="Base Rate"
          sub={data.per_kg_mode ? `Zone ${data.zone} · ₹${(data.base_rate - data.demand_surcharge).toFixed(2)}/kg` : `Zone ${data.zone}`}
          value={data.per_kg_mode ? fmt(data.base_rate - data.demand_surcharge) + "/kg" : fmt(data.base_rate - data.demand_surcharge)}
        />
        {data.demand_surcharge > 0 && (
          <Row
            label="Demand Surcharge"
            sub={data.per_kg_mode ? "per kg" : "min ₹85"}
            value={data.per_kg_mode ? fmt(data.demand_surcharge) + "/kg" : fmt(data.demand_surcharge)}
          />
        )}
        <Row
          label="ADD-ESS"
          sub={`₹${data.ess_rate}/kg${data.per_kg_mode ? "" : ` × ${data.chargeable_weight} kg`}`}
          value={data.per_kg_mode ? fmt(data.ess_fee) + "/kg" : fmt(data.ess_fee)}
        />
        <Row label="Subtotal" value={data.per_kg_mode ? fmt(data.subtotal_1) + "/kg" : fmt(data.subtotal_1)} bold />
        <Row label="ADD-FS" sub={`${data.fuel_surcharge_pct}%`} value={data.per_kg_mode ? fmt(data.fuel_surcharge) + "/kg" : fmt(data.fuel_surcharge)} />
        <Row label="Subtotal" value={data.per_kg_mode ? fmt(data.subtotal_2) + "/kg" : fmt(data.subtotal_2)} bold />
        <Row label="ADD-GST" sub={`${data.gst_pct}%`} value={data.per_kg_mode ? fmt(data.gst) + "/kg" : fmt(data.gst)} />
        <Row label="Costing" value={data.per_kg_mode ? fmt(data.subtotal_3) + "/kg" : fmt(data.subtotal_3)} bold />
        <Row label="Local Charge" value={data.per_kg_mode ? fmt(data.local_charge) + "/kg" : fmt(data.local_charge)} />
        {data.clearance_charge > 0 && (
          <Row label="Clearance Charge" sub="commercial" value={data.per_kg_mode ? fmt(data.clearance_charge) + "/kg" : fmt(data.clearance_charge)} />
        )}
        <Row label="Margin" value={data.per_kg_mode ? fmt(data.margin) + "/kg" : fmt(data.margin)} />
        {data.per_kg_mode && (
          <>
            <Row label="Per-kg Total" value={fmt(data.total_per_kg) + "/kg"} bold />
            <Row label="× Chargeable Weight" sub={`${data.total_per_kg.toFixed(2)} × ${data.chargeable_weight} kg`} value={fmt(data.total_per_kg * data.chargeable_weight)} />
          </>
        )}
      </div>

      {/* Total */}
      <div className="px-5 sm:px-6 py-5 bg-slate-900 text-white">
        <div className="flex items-baseline justify-between gap-3 mb-2">
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/70">Total Quote</div>
          <div
            className="font-mono tabular-nums font-bold whitespace-nowrap text-xl sm:text-2xl lg:text-3xl"
            data-testid="fedex-breakdown-total"
          >
            {fmt(data.total)}
          </div>
        </div>
        {data.chargeable_weight > 0 && (
          <div className="flex items-baseline justify-between pt-3 border-t border-slate-700/50 text-slate-300">
            <div className="text-[10px] tracking-[0.2em] uppercase">Per KG Cost</div>
            <div className="font-mono tabular-nums text-sm text-yellow-400 font-semibold" data-testid="fedex-breakdown-per-kg">
              {fmt(data.total / data.chargeable_weight)} / kg
            </div>
          </div>
        )}
      </div>

      {data.notes?.length > 0 && (
        <div className="px-5 sm:px-6 py-3 space-y-1.5 bg-slate-50">
          {data.notes.map((n, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-blue-600" />
              <span>{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

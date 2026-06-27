import { User, MapPin, Package as PkgIcon, Info, Layers } from "lucide-react";

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

export default function SelfBreakdown({ data, customerName }) {
  if (!data) return null;

  const showBifurcation = false;

  return (
    <div className="rounded-md bg-white border border-slate-200 shadow-sm overflow-hidden" data-testid="self-breakdown">
      {/* Header strip */}
      <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-teal-600 to-cyan-500 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <Layers className="w-4 h-4" />
          <span className="font-semibold text-sm tracking-wider">SELF NETWORK</span>
        </div>
        <span className="text-[10px] tracking-[0.25em] uppercase text-white/70 font-medium">Quote</span>
      </div>

      {/* Customer + destination */}
      <div className="px-5 sm:px-6 py-4 border-b border-slate-100 space-y-2">
        {customerName && (
          <div className="flex items-center gap-2 text-sm text-slate-700" data-testid="self-breakdown-customer">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100">
              <User className="w-3 h-3 text-slate-500" />
            </span>
            <span className="font-medium">{customerName}</span>
          </div>
        )}
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 mt-1 text-slate-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-lg sm:text-xl text-slate-900 leading-tight" data-testid="self-breakdown-country">
              {data.country.name}
              <span className="text-slate-400 font-normal ml-2 text-sm">({data.country.code})</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
              <span className="font-mono">{data.service_code}</span>
              {data.zone && (
                <>
                  <span>·</span>
                  <span className="font-mono">{data.zone}</span>
                </>
              )}
              <span>·</span>
              <PkgIcon className="w-3 h-3" />
              <span>Chargeable {data.chargeable_weight} kg</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              Actual {data.actual_weight} kg · Volumetric {data.volumetric_weight} kg
            </div>
          </div>
        </div>
      </div>

      {/* Rate breakdown rows */}
      {showBifurcation && (
        <div className="px-5 sm:px-6 py-3 space-y-0" data-testid="self-breakdown-rows">
          {data.per_kg_mode && (
            <div className="py-2 text-[10px] tracking-[0.2em] uppercase text-teal-700 bg-teal-50 -mx-5 sm:-mx-6 px-5 sm:px-6 border-b border-teal-100 mb-2">
              Per-kg breakdown · all amounts below are per kg
            </div>
          )}
          <Row label="Base Rate"
            sub={data.per_kg_mode
              ? `₹${(data.base_rate / data.chargeable_weight).toFixed(2)}/kg`
              : `Destination: ${data.destination}`}
            value={data.per_kg_mode ? fmt(data.base_rate / data.chargeable_weight) + "/kg" : fmt(data.base_rate)}
          />
          <Row label="Subtotal" value={data.per_kg_mode ? fmt(data.subtotal_1) + "/kg" : fmt(data.subtotal_1)} bold />
          {data.fuel_surcharge_pct > 0 && (
            <Row label="Fuel Surcharge" sub={`${data.fuel_surcharge_pct}%`} value={data.per_kg_mode ? fmt(data.fuel_surcharge) + "/kg" : fmt(data.fuel_surcharge)} />
          )}
          {data.fuel_surcharge_pct > 0 && (
            <Row label="Subtotal" value={data.per_kg_mode ? fmt(data.subtotal_2) + "/kg" : fmt(data.subtotal_2)} bold />
          )}
          <Row label="GST" sub={`${data.gst_pct}%`} value={data.per_kg_mode ? fmt(data.gst) + "/kg" : fmt(data.gst)} />
          <Row label="Costing" value={data.per_kg_mode ? fmt(data.subtotal_3) + "/kg" : fmt(data.subtotal_3)} bold />
          <Row label="Local Charge" value={data.per_kg_mode ? fmt(data.local_charge) + "/kg" : fmt(data.local_charge)} />
          <Row label="Margin" value={data.per_kg_mode ? fmt(data.margin) + "/kg" : fmt(data.margin)} />
          {data.per_kg_mode && (
            <>
              <Row label="Per-kg Total" value={fmt(data.total_per_kg) + "/kg"} bold />
              <Row label="× Chargeable Weight" sub={`${data.total_per_kg.toFixed(2)} × ${data.chargeable_weight} kg`} value={fmt(data.total_per_kg * data.chargeable_weight)} />
            </>
          )}
        </div>
      )}

      {/* Total */}
      <div className="px-5 sm:px-6 py-5 bg-slate-900 text-white">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-[10px] tracking-[0.3em] uppercase text-white/70">
            {data.chargeable_weight > 30 ? "Total Quote (Per KG)" : "Total Quote"}
          </div>
          <div
            className="font-mono tabular-nums font-bold whitespace-nowrap text-xl sm:text-2xl lg:text-3xl"
            data-testid="self-breakdown-total"
          >
            {data.chargeable_weight > 30
              ? fmt(data.total_per_kg ?? (data.total / data.chargeable_weight)) + " / kg"
              : fmt(data.total)}
          </div>
        </div>
      </div>

      {data.notes?.length > 0 && (
        <div className="px-5 sm:px-6 py-3 space-y-1.5 bg-slate-50 border-b border-slate-100" data-testid="self-breakdown-notes">
          {data.notes.map((n, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-teal-600" />
              <span>{n}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-100" data-testid="general-remarks">
        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold text-slate-500 mb-2">Remark</div>
        <ol className="list-decimal list-inside text-[11px] text-slate-600 space-y-1.5 leading-relaxed font-sans">
          <li>Commercial charges 3540/- extra if any</li>
          <li>Weight above 24 kgs charge extra approx 3390/- per crtn</li>
          <li>Oda / remote area charges applicable .</li>
          <li>Validity of rate one week</li>
        </ol>
      </div>

      {data.notes?.length > 0 && (
        <div className="px-5 sm:px-6 py-3 space-y-1.5 bg-slate-50 border-b border-slate-100" data-testid="self-breakdown-notes">
          {data.notes.map((n, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
              <Info className="w-3 h-3 mt-0.5 flex-shrink-0 text-teal-600" />
              <span>{n}</span>
            </div>
          ))}
        </div>
      )}

      <div className="px-5 sm:px-6 py-4 bg-slate-50 border-t border-slate-100" data-testid="general-remarks">
        <div className="text-[10px] tracking-[0.2em] uppercase font-semibold text-slate-500 mb-2">Remark</div>
        <ol className="list-decimal list-inside text-[11px] text-slate-600 space-y-1.5 leading-relaxed font-sans">
          <li>Commercial charges 3540/- extra if any</li>
          <li>Weight above 24 kgs charge extra approx 3390/- per crtn</li>
          <li>Oda / remote area charges applicable .</li>
        </ol>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
import { toast } from "sonner";
import {
  Calculator,
  LogOut,
  Plane,
  ChevronsUpDown,
  Check,
  FileText,
  Package,
  Loader2,
  Shield,
  User,
  Sparkles,
  AlertTriangle,
  Layers,
  ShieldCheck,
  Download,
  Mail,
  Copy,
  MessageSquare,
} from "lucide-react";
import AdminPanel from "../components/AdminPanel";

const cn = (...a) => a.filter(Boolean).join(" ");

export default function Dashboard() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  const [countries, setCountries] = useState([]);
  const [loadingCountries, setLoadingCountries] = useState(true);

  const [customerName, setCustomerName] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [weight, setWeight] = useState("");
  const [shipmentType, setShipmentType] = useState("nondocument");

  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null); // DHL-only path
  const [bothResult, setBothResult] = useState(null); // { dhl, fedex, dhl_error, fedex_error, self_carrier, ups }
  const [selfResult, setSelfResult] = useState(null);
  const [upsResult, setUpsResult] = useState(null);
  const [fedexResult, setFedexResult] = useState(null);

  const [selfPostcode, setSelfPostcode] = useState("");
  const [selfSuburb, setSelfSuburb] = useState("");
  const [selfServiceCode, setSelfServiceCode] = useState("SELF");

  const [countryOpen, setCountryOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [carrier, setCarrier] = useState("dhl"); // default: dhl

  const getSelfServices = (countryCode) => {
    const cc = countryCode?.toUpperCase() || "";
    if (cc === "AU") return ["AU ECONOMY", "AU NON FOOD", "SIN-DHL"];
    if (cc === "NZ") return ["NZ ECONOMY", "SG FEDEX ECO"];
    if (cc === "CA") return ["CA ECONOMY", "CA ECO DUTY PAID", "IMPORT"];
    if (cc === "SG" || cc === "TH") return ["FOOD", "NON FOOD"];
    if (cc === "MY") return ["SELF", "REMOTE", "DUTY PAID"];
    if (["AE", "BH", "KW", "LK", "OM", "QA", "SA", "KE", "NG", "TZ", "UG", "ZM"].includes(cc)) {
      return ["SELF", "DUTY PAID"];
    }
    if (cc === "GB") return ["EXPRESS", "FREIGHT", "FREIGHT DP", "IMPORT"];
    if (cc === "CH" || cc === "NO") return ["LHR UPS"];
    if (cc === "HK") return ["SELF", "IMPORT"];
    if (cc === "US") return ["IMPORT", "PREMIUM GROUND"];
    if (["AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "HU", "IE", "IT", "LV", "LT", "LU", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"].includes(cc)) {
      return ["GR DPD EXP"];
    }
    return ["SELF"];
  };

  useEffect(() => {
    if (countryCode) {
      const services = getSelfServices(countryCode);
      setSelfServiceCode(services[0] || "SELF");
    }
  }, [countryCode]);

  useEffect(() => {
    api
      .get("/countries")
      .then((r) => setCountries(r.data))
      .catch(() => toast.error("Failed to load countries"))
      .finally(() => setLoadingCountries(false));
  }, []);

  const selectedCountry = countries.find((c) => c.code === countryCode);

  const resetResults = () => {
    setResult(null);
    setBothResult(null);
    setSelfResult(null);
    setUpsResult(null);
    setFedexResult(null);
  };

  const onCalculateUnified = async (e) => {
    e?.preventDefault();
    if (!customerName.trim()) return toast.error("Customer name is required");
    if (!countryCode) return toast.error("Select a destination country");
    const w = parseFloat(weight);
    if (!w || w <= 0) return toast.error("Enter a valid weight");

    setCalculating(true);
    resetResults();
    try {
      const res = await api.post("/calculate-both", {
        customer_name: customerName.trim(),
        country_code: countryCode,
        weight_kg: w,
        shipment_type: shipmentType,
        postcode: null,
        suburb: null,
        self_service_code: selfServiceCode || null,
      });
      setBothResult(res.data);
      setResult(res.data.dhl);
      setFedexResult(res.data.fedex);
      setSelfResult(res.data.self_carrier);
      setUpsResult(res.data.ups);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to calculate");
    } finally {
      setCalculating(false);
    }
  };

  const reset = () => {
    setCustomerName("");
    setCountryCode("");
    setWeight("");
    setSelfPostcode("");
    setSelfSuburb("");
    resetResults();
  };

  const switchCarrier = (c) => {
    setCarrier(c);
    resetResults();
  };

  // shared single-form renderer (DHL + Both modes use it)
  const renderForm = (onSubmit, buttonLabel, accentBtn = "bg-slate-900 hover:bg-slate-800") => (
    <div className="border border-slate-200 rounded-sm bg-white" data-testid="calculator-form">
      <div className="p-5 border-b border-slate-200">
        <div className="flex items-center gap-2">
          {carrier === "both" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-slate-900 text-white rounded-sm">
              <Sparkles className="w-3 h-3" /> Compare All
            </span>
          ) : carrier === "self" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-teal-600 text-white rounded-sm">
              <Layers className="w-3 h-3" /> SELF
            </span>
          ) : carrier === "ups" ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-amber-800 text-white rounded-sm">
              <ShieldCheck className="w-3 h-3" /> UPS
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-yellow-400 text-slate-900 rounded-sm">
              <Plane className="w-3 h-3" /> DHL
            </span>
          )}
          <div className="text-xs tracking-[0.25em] uppercase text-slate-500">Calculate</div>
        </div>
        <div className="font-display text-xl text-slate-900 mt-1.5">
          {carrier === "both" ? "One form · all quotes" : "Shipment details"}
        </div>
      </div>
      <form onSubmit={onSubmit} className="p-5 space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="dhl-customer" className="text-xs tracking-wider uppercase text-slate-600 flex items-center gap-1.5">
            <User className="w-3 h-3" /> Customer name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="dhl-customer"
            type="text"
            required
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="e.g. Acme Industries"
            className="rounded-sm h-11 border-slate-300"
            data-testid="customer-name-input"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs tracking-wider uppercase text-slate-600">Destination country</Label>
          <Popover open={countryOpen} onOpenChange={setCountryOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className="w-full justify-between rounded-sm h-11 border-slate-300 font-normal"
                data-testid="country-select-trigger"
              >
                {selectedCountry ? (
                  <span className="flex items-center gap-2">
                    <span>{selectedCountry.name}</span>
                    <span className="text-xs text-slate-400 font-mono">({selectedCountry.code})</span>
                  </span>
                ) : (
                  <span className="text-slate-400">
                    {loadingCountries ? "Loading countries…" : "Select destination…"}
                  </span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
              <Command>
                <CommandInput placeholder="Search 230+ countries…" data-testid="country-search" />
                <CommandList>
                  <CommandEmpty>No country found.</CommandEmpty>
                  <CommandGroup>
                    {countries.map((c) => (
                      <CommandItem
                        key={c.code}
                        value={`${c.name} ${c.code}`}
                        onSelect={() => {
                          setCountryCode(c.code);
                          setCountryOpen(false);
                        }}
                        data-testid={`country-option-${c.code}`}
                      >
                        <Check className={cn("mr-2 h-4 w-4", countryCode === c.code ? "opacity-100" : "opacity-0")} />
                        <span className="flex-1">{c.name}</span>
                        <span className="text-xs text-slate-400 font-mono">{c.code}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {carrier === "self" && countryCode && (
          <div className="space-y-1.5">
            <Label htmlFor="self-service" className="text-xs tracking-wider uppercase text-slate-600">Service Option</Label>
            <select
              id="self-service"
              value={selfServiceCode}
              onChange={(e) => setSelfServiceCode(e.target.value)}
              className="w-full rounded-sm h-11 border border-slate-300 bg-white px-3 text-sm"
            >
              {getSelfServices(countryCode).map((sc) => (
                <option key={sc} value={sc}>{sc}</option>
              ))}
            </select>
          </div>
        )}

        {/* Postcode/Suburb inputs removed per user request */}

        {carrier !== "self" && (
          <div className="space-y-1.5">
            <Label className="text-xs tracking-wider uppercase text-slate-600">Shipment type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShipmentType("document")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 border rounded-sm text-sm transition-colors",
                  shipmentType === "document"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                )}
                data-testid="shipment-type-document"
              >
                <FileText className="w-4 h-4" />
                Document
              </button>
              <button
                type="button"
                onClick={() => setShipmentType("nondocument")}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 border rounded-sm text-sm transition-colors",
                  shipmentType === "nondocument"
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                )}
                data-testid="shipment-type-nondocument"
              >
                <Package className="w-4 h-4" />
                Non-Document
              </button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="weight" className="text-xs tracking-wider uppercase text-slate-600">
            Actual weight <span className="text-slate-400 normal-case">(kg)</span>
          </Label>
          <Input
            id="weight"
            type="number"
            step="0.01"
            min="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 2.5"
            className="rounded-sm h-11 border-slate-300 font-mono"
            data-testid="weight-input"
          />
        </div>

        <div className="flex items-center gap-2 pt-2">
          <Button
            type="submit"
            disabled={calculating}
            className={cn("flex-1 h-11 rounded-sm text-white", accentBtn)}
            data-testid="calculate-btn"
          >
            {calculating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
            {calculating ? "Calculating…" : buttonLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-sm"
            onClick={reset}
            data-testid="reset-btn"
          >
            Reset
          </Button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50" data-testid="dashboard">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-sm bg-slate-900 text-white flex items-center justify-center">
              <Plane className="w-4 h-4" />
            </div>
            <div>
              <div className="font-display text-base text-slate-900 leading-none">Aeriindia Calculator</div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-slate-500 mt-0.5">DHL · FedEx · 2026</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 mr-3 font-mono" data-testid="user-email">
              <span>{user?.email}</span>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] tracking-wider uppercase bg-slate-900 text-white rounded-sm" data-testid="admin-badge">
                  <Shield className="w-2.5 h-2.5" /> Admin
                </span>
              )}
            </div>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-sm h-9 border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white"
                onClick={() => setAdminOpen(true)}
                data-testid="open-admin-btn"
              >
                <Shield className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Admin</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="rounded-sm h-9 text-slate-600"
              onClick={logout}
              data-testid="logout-btn"
            >
              <LogOut className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-32 lg:pt-12 lg:pb-48 space-y-6">
        {/* Carrier toggle */}
        <div className="flex items-center gap-2 flex-wrap" data-testid="carrier-toggle">
          <span className="text-[10px] tracking-[0.25em] uppercase text-slate-500 mr-2">Carrier</span>
          <button
            type="button"
            onClick={() => switchCarrier("dhl")}
            className={cn(
              "px-4 py-1.5 text-xs tracking-wider uppercase rounded-sm border transition-colors",
              carrier === "dhl" ? "bg-yellow-400 text-slate-900 border-yellow-500 font-semibold" : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"
            )}
            data-testid="carrier-dhl"
          >
            DHL only
          </button>
          <button
            type="button"
            onClick={() => switchCarrier("fedex")}
            className={cn(
              "px-4 py-1.5 text-xs tracking-wider uppercase rounded-sm border transition-colors",
              carrier === "fedex" ? "bg-purple-700 text-white border-purple-800 font-semibold" : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"
            )}
            data-testid="carrier-fedex"
          >
            FedEx only
          </button>
          <button
            type="button"
            onClick={() => switchCarrier("self")}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-1.5 text-xs tracking-wider uppercase rounded-sm border transition-colors",
              carrier === "self" ? "bg-teal-600 text-white border-teal-700 font-semibold" : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"
            )}
            data-testid="carrier-self"
          >
            <Layers className="w-3.5 h-3.5" />
            SELF only
          </button>
          <button
            type="button"
            onClick={() => switchCarrier("ups")}
            className={cn(
              "inline-flex items-center gap-1.5 px-4 py-1.5 text-xs tracking-wider uppercase rounded-sm border transition-colors",
              carrier === "ups" ? "bg-amber-800 text-white border-amber-900 font-semibold" : "bg-white text-slate-600 border-slate-300 hover:border-slate-500"
            )}
            data-testid="carrier-ups"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-yellow-400" />
            UPS only
          </button>
        </div>

        {carrier === "fedex" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">{renderForm(onCalculateUnified, "Calculate FedEx rate", "bg-purple-700 hover:bg-purple-800")}</div>
            <div className="lg:col-span-3">
              {bothResult ? (
                <SummaryTable bothResult={bothResult} countryCode={countryCode} weight={weight} />
              ) : (
                <EmptyState label="Your FedEx quote will appear here" />
              )}
            </div>
          </div>
        )}

        {carrier === "dhl" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">{renderForm(onCalculateUnified, "Calculate DHL rate")}</div>
            <div className="lg:col-span-3">
              {bothResult ? (
                <SummaryTable bothResult={bothResult} countryCode={countryCode} weight={weight} />
              ) : (
                <EmptyState label="Your DHL quote will appear here" />
              )}
            </div>
          </div>
        )}

        {carrier === "self" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">{renderForm(onCalculateUnified, "Calculate SELF rate", "bg-teal-600 hover:bg-teal-700")}</div>
            <div className="lg:col-span-3">
              {bothResult ? (
                <SummaryTable bothResult={bothResult} countryCode={countryCode} weight={weight} />
              ) : (
                <EmptyState label="Your SELF quote will appear here" />
              )}
            </div>
          </div>
        )}

        {carrier === "ups" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">{renderForm(onCalculateUnified, "Calculate UPS rate", "bg-amber-800 hover:bg-amber-900")}</div>
            <div className="lg:col-span-3">
              {bothResult ? (
                <SummaryTable bothResult={bothResult} countryCode={countryCode} weight={weight} />
              ) : (
                <EmptyState label="Your UPS quote will appear here" />
              )}
            </div>
          </div>
        )}

        {carrier === "both" && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              {renderForm(onCalculateUnified, "Compare All Carriers", "bg-slate-900 hover:bg-slate-800")}
            </div>
            <div className="lg:col-span-3">
              {bothResult ? (
                <SummaryTable bothResult={bothResult} countryCode={countryCode} weight={weight} />
              ) : (
                <EmptyState label="All carrier quotes will appear here" />
              )}
            </div>
          </div>
        )}
      </main>

      {isAdmin && <AdminPanel open={adminOpen} onOpenChange={setAdminOpen} countries={countries} onSettingsSaved={resetResults} />}
    </div>
  );
}

function SummaryTable({ bothResult, countryCode, weight }) {
  if (!bothResult) return null;

  const fmt = (n) => {
    if (n === undefined || n === null) return "-";
    return "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getValidityDateStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
  };

  const validityDate = getValidityDateStr();
  const dhlData = bothResult.dhl;
  
  const countryName = dhlData?.country?.name || bothResult.fedex?.country?.name || bothResult.self_carrier?.country?.name || bothResult.ups?.country?.name || "Destination";
  const actualWeight = dhlData?.actual_weight || bothResult.fedex?.actual_weight || bothResult.self_carrier?.actual_weight || bothResult.ups?.actual_weight || weight;
  const volumetricWeight = dhlData?.volumetric_weight || bothResult.fedex?.volumetric_weight || bothResult.self_carrier?.volumetric_weight || bothResult.ups?.volumetric_weight || 0;
  const chargeableWeight = dhlData?.chargeable_weight || bothResult.fedex?.chargeable_weight || bothResult.self_carrier?.chargeable_weight || bothResult.ups?.chargeable_weight || weight;
  const customer = bothResult.customer_name || "Customer";
  
  const isDoc = dhlData?.shipment_type === "document" || bothResult.fedex?.service === "envelope" || bothResult.ups?.shipment_type === "document";

  const rows = [
    {
      name: "DHL",
      rate: dhlData?.total,
      perKgRate: dhlData?.total_per_kg,
      validity: validityDate,
      logoColor: "bg-yellow-400 text-slate-900 border-yellow-500",
    },
    {
      name: "FEDEX",
      rate: bothResult.fedex?.total,
      perKgRate: bothResult.fedex?.total_per_kg,
      validity: validityDate,
      logoColor: "bg-purple-700 text-white border-purple-800",
    },
    {
      name: "UPS(INEXT )",
      rate: bothResult.ups?.total,
      perKgRate: bothResult.ups?.total_per_kg,
      validity: validityDate,
      logoColor: "bg-amber-800 text-white border-amber-900",
    },
    {
      name: "SELF*",
      rate: bothResult.self_carrier?.total,
      perKgRate: bothResult.self_carrier?.total_per_kg,
      validity: "(LATE DELIVERY )",
      logoColor: "bg-teal-600 text-white border-teal-700",
    }
  ];

  const headerLabel = `${(countryCode || "").toUpperCase()}-${chargeableWeight} KGS`;

  const generateShareText = () => {
    let text = `*Shipping Quote Summary*\n\n`;
    text += `*Customer:* ${customer}\n`;
    text += `*Destination:* ${countryName}\n`;
    text += `*Weight:* ${chargeableWeight} kg (Chargeable)\n`;
    text += `*Type:* ${isDoc ? "Document" : "Non-Document"}\n\n`;
    text += `*Rates (All-Inclusive):*\n`;
    
    rows.forEach(row => {
      let displayRate = "-";
      if (row.rate !== undefined && row.rate !== null && row.rate > 0) {
        if (chargeableWeight > 30) {
          displayRate = fmt(row.perKgRate ?? (row.rate / chargeableWeight)) + " / kg";
        } else {
          displayRate = fmt(row.rate);
        }
      }
      text += `• *${row.name}:* ${displayRate} (Validity: ${row.validity})\n`;
    });
    
    text += `\n*Remarks & Guidelines:*\n`;
    text += `• Validity of rate one week\n`;
    text += `• PARCEL MORE THAN 24 KGS WILL CHARGE EXTRA 3540/- PER CRTN\n`;
    text += `• CUSTOM - 3540/- PER SHIPMENT IF ANY\n`;
    text += `• FOR GULF - RS. 4680/- EXTRA BY DHL\n\n`;
    text += `Generated via *Aeriindia Calculator*`;
    
    return text;
  };

  const downloadPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Popup blocked! Please allow popups to download PDF.");
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Shipping Quote - ${customer}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; }
            .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 24px; color: #0f172a; }
            .header-meta { margin-top: 10px; font-size: 14px; color: #64748b; }
            .details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .detail-block { background: #f8fafc; padding: 15px; border-radius: 6px; border: 1px solid #f1f5f9; }
            .detail-label { font-size: 11px; text-transform: uppercase; tracking: 0.1em; color: #64748b; font-weight: 600; }
            .detail-val { font-size: 16px; font-weight: 700; margin-top: 5px; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f8fafc; padding: 12px; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; text-align: left; }
            td { padding: 14px 12px; font-size: 14px; border-bottom: 1px solid #edf2f7; font-family: monospace; }
            tr.highlight { background: #fff5f5; color: #c53030; font-weight: bold; }
            tr.highlight td { color: #c53030; }
            .remarks { background: #f8fafc; padding: 20px; border-radius: 6px; font-size: 12px; line-height: 1.6; border: 1px solid #e2e8f0; }
            .remarks h3 { margin-top: 0; font-size: 12px; text-transform: uppercase; color: #64748b; }
            .remarks-list { padding-left: 20px; margin: 0; }
            .remarks-item { margin-bottom: 8px; }
            .remarks-item.highlight { color: #c53030; font-weight: bold; list-style-type: square; }
            @media print {
              body { padding: 0; }
              @page { margin: 1.5cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Aeriindia Rate Calculator</h1>
            <div class="header-meta">Generated on ${new Date().toLocaleDateString("en-IN")}</div>
          </div>
          
          <div class="details">
            <div class="detail-block">
              <div class="detail-label">Customer Name</div>
              <div class="detail-val">${customer}</div>
            </div>
            <div class="detail-block">
              <div class="detail-label">Destination Country</div>
              <div class="detail-val">${countryName}</div>
            </div>
            <div class="detail-block">
              <div class="detail-label">Weight Details</div>
              <div class="detail-val">${chargeableWeight} KG (Chargeable)</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 5px;">
                Actual: ${actualWeight} kg | Volumetric: ${volumetricWeight} kg
              </div>
            </div>
            <div class="detail-block">
              <div class="detail-label">Shipment Type</div>
              <div class="detail-val">${isDoc ? "Document" : "Non-Document"}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Carrier</th>
                <th style="text-align: right;">Rate</th>
                <th style="text-align: center;">Validity of Rate</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => {
                let displayRate = "-";
                if (row.rate !== undefined && row.rate !== null && row.rate > 0) {
                  if (chargeableWeight > 30) {
                    displayRate = fmt(row.perKgRate ?? (row.rate / chargeableWeight)) + " / kg";
                  } else {
                    displayRate = fmt(row.rate);
                  }
                }
                const isHighlight = row.name.startsWith("UPS") || row.name.startsWith("SELF");
                return `
                  <tr class="${isHighlight ? 'highlight' : ''}">
                    <td>${row.name}</td>
                    <td style="text-align: right;">${displayRate}</td>
                    <td style="text-align: center;">${row.validity}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>

          <div class="remarks">
            <h3>Remarks & Guidelines</h3>
            <ul class="remarks-list">
              <li class="remarks-item">Validity of rate one week</li>
              <li class="remarks-item highlight">PERCEL MORE THAN -24 KGS WILL CHARGE EXTRA 3540/- PER CRTN</li>
              <li class="remarks-item">CUSTOM - 3540/- PER SHIPMENT IF ANY</li>
              <li class="remarks-item highlight">FOR GULF - RS. 4680/- EXTRA BY DHL</li>
            </ul>
          </div>

          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const shareWhatsApp = () => {
    const text = generateShareText();
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const shareEmail = () => {
    const subject = `Shipping Quote: ${customer} to ${countryName}`;
    const body = generateShareText();
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank");
  };

  const copyToClipboard = () => {
    const text = generateShareText();
    navigator.clipboard.writeText(text);
    toast.success("Quote text copied to clipboard!");
  };

  return (
    <div className="rounded-md bg-white border border-slate-200 shadow-md overflow-hidden animate-in fade-in duration-300" data-testid="summary-rate-card">
      {/* Top Banner with main details */}
      <div className="px-6 py-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800">
        <div>
          <div className="text-[10px] tracking-[0.25em] uppercase text-slate-400">Shipment Quote Summary</div>
          <div className="font-display text-xl font-bold mt-1 text-white flex items-center gap-2">
            <span>{customer}</span>
            <span className="text-slate-500 font-normal">to</span>
            <span className="text-yellow-400">{countryName}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 font-mono">
            <span>Actual: {actualWeight} kg</span>
            <span>·</span>
            <span>Volumetric: {volumetricWeight} kg</span>
            <span>·</span>
            <span className="text-yellow-400 font-semibold">Chargeable: {chargeableWeight} kg</span>
            <span>·</span>
            <span>{isDoc ? "Document" : "Non-Doc"}</span>
          </div>
        </div>
        <div className="bg-slate-800 border border-slate-700 px-4 py-2.5 rounded-sm text-center sm:text-right flex-shrink-0">
          <div className="text-[9px] tracking-[0.2em] uppercase text-slate-400">Destination & Weight</div>
          <div className="font-mono font-bold text-lg text-yellow-400 mt-0.5">{headerLabel}</div>
        </div>
      </div>

      {/* Table Rates */}
      <div className="px-6 py-4">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-slate-100 text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-left">
                <th className="px-4 py-3 text-[10px] tracking-[0.2em] uppercase font-bold text-slate-500">Carrier</th>
                <th className="px-4 py-3 text-[10px] tracking-[0.2em] uppercase font-bold text-slate-500 text-right">rate</th>
                <th className="px-4 py-3 text-[10px] tracking-[0.2em] uppercase font-bold text-slate-500 text-center">validity of rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {rows.map((row) => {
                let displayRate = "-";
                if (row.rate !== undefined && row.rate !== null && row.rate > 0) {
                  if (chargeableWeight > 30) {
                    displayRate = fmt(row.perKgRate ?? (row.rate / chargeableWeight)) + " / kg";
                  } else {
                    displayRate = fmt(row.rate);
                  }
                }

                const isUps = row.name.startsWith("UPS");
                const isSelf = row.name.startsWith("SELF");
                
                const nameClass = isUps || isSelf ? "text-red-600 font-bold" : "font-bold text-slate-900";
                const rateClass = isUps || isSelf ? "text-red-600 font-bold text-right text-base" : "font-bold text-slate-900 text-right text-base";
                const valClass = isUps || isSelf ? "text-red-600 font-semibold text-center text-xs" : "text-slate-500 text-center text-xs";
                const rowBg = isUps || isSelf ? "bg-red-50/30 hover:bg-red-50/50" : "hover:bg-slate-50/80";

                return (
                  <tr key={row.name} className={`${rowBg} transition-colors`}>
                    <td className="px-4 py-3.5 flex items-center gap-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[9px] font-bold border ${row.logoColor}`}>
                        {row.name.substring(0, 2)}
                      </span>
                      <span className={nameClass}>{row.name}</span>
                    </td>
                    <td className={`px-4 py-3.5 ${rateClass}`}>{displayRate}</td>
                    <td className={`px-4 py-3.5 ${valClass}`}>{row.validity}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Remarks Section */}
      <div className="px-6 py-5 bg-slate-50 border-t border-slate-200/60 text-xs tracking-wider leading-relaxed space-y-3 font-sans font-semibold">
        <div className="text-[10px] tracking-[0.2em] uppercase font-bold text-slate-500 mb-2">Remarks & Guidelines</div>
        <div className="space-y-2.5">
          <div className="flex items-start gap-2 text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
            <span>Validity of rate one week</span>
          </div>
          <div className="flex items-start gap-2 text-red-600 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1.5 flex-shrink-0" />
            <span>PERCEL MORE THAN -24 KGS WILL CHARGE EXTRA 3540/- PER CRTN</span>
          </div>
          <div className="flex items-start gap-2 text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 flex-shrink-0" />
            <span>CUSTOM - 3540/- PER SHIPMENT IF ANY</span>
          </div>
          <div className="flex items-start gap-2 text-red-600 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 mt-1.5 flex-shrink-0" />
            <span>FOR GULF - RS. 4680/- EXTRA BY DHL</span>
          </div>
        </div>
      </div>

      {/* Action Buttons Section */}
      <div className="px-6 py-4 bg-slate-100/50 border-t border-slate-200/80 flex flex-wrap gap-2.5 justify-center sm:justify-start">
        <Button
          onClick={downloadPDF}
          size="sm"
          className="bg-slate-900 text-white hover:bg-slate-800 rounded-sm h-9 px-3 text-xs flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download PDF</span>
        </Button>
        <Button
          onClick={shareWhatsApp}
          size="sm"
          className="bg-green-600 text-white hover:bg-green-700 rounded-sm h-9 px-3 text-xs flex items-center gap-1.5"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>WhatsApp</span>
        </Button>
        <Button
          onClick={shareEmail}
          size="sm"
          className="bg-blue-600 text-white hover:bg-blue-700 rounded-sm h-9 px-3 text-xs flex items-center gap-1.5"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Email</span>
        </Button>
        <Button
          onClick={copyToClipboard}
          variant="outline"
          size="sm"
          className="border-slate-300 text-slate-700 hover:bg-slate-50 rounded-sm h-9 px-3 text-xs flex items-center gap-1.5"
        >
          <Copy className="w-3.5 h-3.5" />
          <span>Copy Text</span>
        </Button>
      </div>
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div className="border border-dashed border-slate-300 rounded-md bg-white p-8 sm:p-12 text-center" data-testid="empty-state">
      <div className="w-14 h-14 mx-auto rounded-md bg-slate-100 flex items-center justify-center">
        <Calculator className="w-6 h-6 text-slate-400" />
      </div>
      <h3 className="font-display text-base sm:text-lg text-slate-900 mt-5">{label}</h3>
      <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
        Enter customer, destination, shipment type and weight to see your all-inclusive quote.
      </p>
    </div>
  );
}

function ComparisonBar({ bothResult }) {
  const options = [
    { name: "DHL", total: bothResult.dhl?.total },
    { name: "FedEx", total: bothResult.fedex?.total },
    { name: "SELF", total: bothResult.self_carrier?.total },
    { name: "UPS", total: bothResult.ups?.total }
  ].filter(o => typeof o.total === "number");

  if (options.length < 2) return null;

  options.sort((a, b) => a.total - b.total);
  const cheapest = options[0];
  const secondCheapest = options[1];
  const savings = secondCheapest.total - cheapest.total;

  const fmt = (n) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  
  const accentMap = {
    "DHL": "from-yellow-400 to-yellow-300 text-slate-900",
    "FedEx": "from-purple-700 to-purple-600 text-white",
    "SELF": "from-teal-600 to-teal-500 text-white",
    "UPS": "from-amber-800 to-amber-700 text-white"
  };

  const accent = accentMap[cheapest.name] || "from-slate-900 to-slate-800 text-white";

  return (
    <div
      className={`rounded-md bg-gradient-to-r ${accent} px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-sm`}
      data-testid="comparison-bar"
    >
      <div>
        <div className="text-[10px] tracking-[0.25em] uppercase opacity-70">Cheaper option</div>
        <div className="font-display text-lg sm:text-xl font-semibold mt-0.5" data-testid="cheaper-carrier">
          {cheapest.name} (₹{cheapest.total.toFixed(2)})
        </div>
      </div>
      <div className="text-left sm:text-right">
        <div className="text-[10px] tracking-[0.25em] uppercase opacity-70">Savings vs {secondCheapest.name}</div>
        <div className="font-mono tabular-nums font-bold text-lg sm:text-xl mt-0.5" data-testid="savings-amount">
          {fmt(savings)}
        </div>
      </div>
    </div>
  );
}

function ErrorCard({ carrier, message, accent }) {
  return (
    <div className="border border-slate-200 rounded-md bg-white shadow-sm overflow-hidden" data-testid={`${carrier.toLowerCase()}-error-card`}>
      <div className={`px-5 sm:px-6 py-4 ${accent}`}>
        <span className="font-semibold text-sm tracking-wider">{carrier.toUpperCase()}</span>
      </div>
      <div className="p-6">
        <div className="font-display text-base text-slate-900 mb-2">Quote not available</div>
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}

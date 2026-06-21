import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { toast } from "sonner";
import { Calculator, ChevronsUpDown, Check, Mail, Package, Loader2, User } from "lucide-react";
import FedexBreakdown from "./FedexBreakdown";

const cn = (...a) => a.filter(Boolean).join(" ");

export default function FedexCalculator() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [countries, setCountries] = useState([]);
  const [country, setCountry] = useState("");
  const [open, setOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [weight, setWeight] = useState("");
  const [service, setService] = useState("package");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api
      .get("/fedex/countries")
      .then((r) => setCountries(r.data))
      .catch(() => toast.error("Failed to load FedEx countries"))
      .finally(() => setLoading(false));
  }, []);

  const selected = countries.find((c) => c.name === country);

  const onCalculate = async (e) => {
    e?.preventDefault();
    if (!customerName.trim()) return toast.error("Customer name is required");
    if (!country) return toast.error("Select a destination country");
    const w = parseFloat(weight);
    if (!w || w <= 0) return toast.error("Enter a valid weight");

    setCalculating(true);
    setResult(null);
    try {
      // Non-admin: backend auto-selects envelope (≤2.5kg) else package
      const effectiveService = isAdmin ? service : (w <= 2.5 ? "envelope" : "package");
      const payload = {
        customer_name: customerName.trim(),
        country,
        weight_kg: w,
        service: effectiveService,
        length_cm: isAdmin && length ? parseFloat(length) : null,
        width_cm: isAdmin && width ? parseFloat(width) : null,
        height_cm: isAdmin && height ? parseFloat(height) : null,
      };
      const res = await api.post("/fedex/calculate", payload);
      setResult(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to calculate");
    } finally {
      setCalculating(false);
    }
  };

  const reset = () => {
    setCustomerName("");
    setCountry("");
    setWeight("");
    setLength("");
    setWidth("");
    setHeight("");
    setResult(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6" data-testid="fedex-calculator">
      <div className="lg:col-span-2">
        <div className="border border-slate-200 rounded-sm bg-white">
          <div className="p-5 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="inline-block px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-purple-700 text-white rounded-sm">FedEx</span>
              <div className="text-xs tracking-[0.25em] uppercase text-slate-500">Calculate</div>
            </div>
            <div className="font-display text-xl text-slate-900 mt-1.5">FedEx Export Quote</div>
          </div>
          <form onSubmit={onCalculate} className="p-5 space-y-5">
            {/* Customer name — required all roles */}
            <div className="space-y-1.5">
              <Label htmlFor="fx-customer" className="text-xs tracking-wider uppercase text-slate-600 flex items-center gap-1.5">
                <User className="w-3 h-3" /> Customer name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="fx-customer"
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Acme Industries"
                className="rounded-sm h-11 border-slate-300"
                data-testid="fedex-customer-name-input"
              />
            </div>

            {/* Country */}
            <div className="space-y-1.5">
              <Label className="text-xs tracking-wider uppercase text-slate-600">Destination country</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between rounded-sm h-11 border-slate-300 font-normal"
                    data-testid="fedex-country-trigger"
                  >
                    {selected ? (
                      <span className="flex items-center gap-2 truncate">
                        <span className="truncate">{selected.name}</span>
                        {isAdmin && (
                          <span className="text-[10px] font-mono text-purple-700 bg-purple-50 border border-purple-200 rounded-sm px-1.5 py-0.5 flex-shrink-0">Z{selected.zone}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400">{loading ? "Loading…" : "Select destination…"}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command>
                    <CommandInput placeholder="Search countries…" data-testid="fedex-country-search" />
                    <CommandList>
                      <CommandEmpty>No country found.</CommandEmpty>
                      <CommandGroup>
                        {countries.map((c) => (
                          <CommandItem
                            key={c.name}
                            value={c.name}
                            onSelect={() => { setCountry(c.name); setOpen(false); }}
                            data-testid={`fedex-country-option-${c.name}`}
                          >
                            <Check className={cn("mr-2 h-4 w-4", country === c.name ? "opacity-100" : "opacity-0")} />
                            <span className="flex-1">{c.name}</span>
                            {isAdmin && <span className="text-[10px] font-mono text-slate-500">Z{c.zone}</span>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Service — admin only */}
            {isAdmin && (
              <div className="space-y-1.5">
                <Label className="text-xs tracking-wider uppercase text-slate-600">Service</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setService("envelope")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 border rounded-sm text-sm transition-colors",
                      service === "envelope" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                    )}
                    data-testid="fedex-service-envelope"
                  >
                    <Mail className="w-4 h-4" />
                    Envelope
                  </button>
                  <button
                    type="button"
                    onClick={() => setService("package")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 border rounded-sm text-sm transition-colors",
                      service === "package" ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                    )}
                    data-testid="fedex-service-package"
                  >
                    <Package className="w-4 h-4" />
                    Package
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="fx-weight" className="text-xs tracking-wider uppercase text-slate-600">
                Weight <span className="text-slate-400 normal-case">(kg)</span>
              </Label>
              <Input
                id="fx-weight"
                type="number"
                step="0.01"
                min="0.1"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 2.5"
                className="rounded-sm h-11 border-slate-300 font-mono"
                data-testid="fedex-weight-input"
              />
            </div>

            {/* Dimensions — admin only */}
            {isAdmin && (
              <div className="space-y-1.5">
                <Label className="text-xs tracking-wider uppercase text-slate-600 flex items-center justify-between">
                  Dimensions <span className="text-slate-400 normal-case text-[10px]">optional · cm</span>
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" value={length} onChange={(e) => setLength(e.target.value)} placeholder="L" className="rounded-sm h-10 border-slate-300 font-mono" data-testid="fedex-length" />
                  <Input type="number" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="W" className="rounded-sm h-10 border-slate-300 font-mono" data-testid="fedex-width" />
                  <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="H" className="rounded-sm h-10 border-slate-300 font-mono" data-testid="fedex-height" />
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="border-t border-slate-200 pt-4 text-[11px] text-slate-500 leading-relaxed">
                <span className="font-medium text-slate-700">Admin note:</span>{" "}
                ADD-ESS, ADD-FS, Margin and Clearance defaults are applied automatically from{" "}
                <span className="text-slate-700 font-medium">Settings</span>.
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" disabled={calculating} className="flex-1 h-11 rounded-sm bg-slate-900 hover:bg-slate-800 text-white" data-testid="fedex-calculate-btn">
                {calculating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
                {calculating ? "Calculating…" : "Calculate FedEx rate"}
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-sm" onClick={reset} data-testid="fedex-reset-btn">Reset</Button>
            </div>
          </form>
        </div>
      </div>

      <div className="lg:col-span-3">
        {result ? (
          <FedexBreakdown data={result} customerName={customerName} />
        ) : (
          <div className="border border-dashed border-slate-300 rounded-sm bg-white p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-sm bg-purple-50 flex items-center justify-center">
              <Calculator className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-display text-lg text-slate-900 mt-5">FedEx quote will appear here</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto">
              Enter customer, destination and weight to see your all-inclusive FedEx total.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

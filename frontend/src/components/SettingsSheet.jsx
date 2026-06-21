import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { api } from "../lib/api";
import { toast } from "sonner";

const FIELDS = [
  { key: "ess_per_kg", label: "DHL · ESS per kg (₹)", step: "0.01", group: "DHL" },
  { key: "fuel_surcharge_pct", label: "DHL · Fuel Surcharge %", step: "0.01", group: "DHL" },
  { key: "gst_pct", label: "DHL · GST %", step: "0.01", group: "DHL" },
  { key: "local_min_charge", label: "DHL · Local minimum (₹)", step: "0.01", group: "DHL" },
  { key: "local_per_kg", label: "DHL · Local per kg (₹)", step: "0.01", group: "DHL" },
  { key: "local_threshold_kg", label: "DHL · Local threshold (kg)", step: "0.5", group: "DHL" },
  { key: "margin_flat", label: "DHL · Margin flat (≤ threshold) (₹)", step: "1", group: "DHL" },
  { key: "margin_per_kg_over_threshold", label: "DHL · Margin per kg (> threshold) (₹)", step: "1", group: "DHL" },
  { key: "margin_threshold_kg", label: "DHL · Margin threshold (kg)", step: "1", group: "DHL" },
  { key: "volumetric_divisor", label: "Volumetric Divisor", step: "1", group: "DHL" },
  { key: "gulf_surcharge", label: "DHL · Gulf Surcharge (₹)", step: "1", group: "DHL" },
  { key: "heavy_carton_surcharge", label: "DHL · Heavy Carton Surcharge (₹)", step: "1", group: "DHL" },
  {key: "fedex_ess_rate", label: "FedEx · ADD-ESS per kg (₹)", step: "0.01", group: "FedEx"},
  {key: "fedex_fuel_surcharge_pct", label: "FedEx · ADD-FS %", step: "0.01", group: "FedEx"},
  {key: "fedex_gst_pct", label: "FedEx · GST %", step: "0.01", group: "FedEx"},
  {key: "fedex_local_per_kg", label: "FedEx · Local per kg (₹)", step: "0.01", group: "FedEx"},
  {key: "fedex_margin", label: "FedEx · Margin flat (≤ threshold) (₹)", step: "0.01", group: "FedEx"},
  {key: "fedex_margin_per_kg_over_threshold", label: "FedEx · Margin per kg (> threshold) (₹)", step: "1", group: "FedEx"},
  {key: "fedex_margin_threshold_kg", label: "FedEx · Margin threshold (kg)", step: "1", group: "FedEx"},
  {key: "fedex_clearance_charge", label: "FedEx · Clearance Charge (₹)", step: "0.01", group: "FedEx"},
  {key: "self_fuel_surcharge_pct", label: "SELF · Fuel Surcharge %", step: "0.01", group: "SELF"},
  {key: "self_gst_pct", label: "SELF · GST %", step: "0.01", group: "SELF"},
  {key: "self_local_per_kg", label: "SELF · Local per kg (₹)", step: "0.01", group: "SELF"},
  {key: "self_margin", label: "SELF · Margin flat (≤ threshold) (₹)", step: "1", group: "SELF"},
  {key: "self_margin_per_kg_over_threshold", label: "SELF · Margin per kg (> threshold) (₹)", step: "1", group: "SELF"},
  {key: "self_margin_threshold_kg", label: "SELF · Margin threshold (kg)", step: "1", group: "SELF"},
  {key: "ups_fuel_surcharge_pct", label: "UPS · Fuel Surcharge %", step: "0.01", group: "UPS"},
  {key: "ups_gst_pct", label: "UPS · GST %", step: "0.01", group: "UPS"},
  {key: "ups_local_per_kg", label: "UPS · Local per kg (₹)", step: "0.01", group: "UPS"},
  {key: "ups_margin", label: "UPS · Margin flat (≤ threshold) (₹)", step: "1", group: "UPS"},
  {key: "ups_margin_per_kg_over_threshold", label: "UPS · Margin per kg (> threshold) (₹)", step: "1", group: "UPS"},
  {key: "ups_margin_threshold_kg", label: "UPS · Margin threshold (kg)", step: "1", group: "UPS"},
];

export default function SettingsSheet({open, onOpenChange, onSaved}) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      api.get("/settings").then((r) => setSettings(r.data)).catch(() => toast.error("Failed to load settings"));
    }
  }, [open]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put("/settings", settings);
      toast.success("Settings updated");
      setSettings(res.data);
      onSaved?.(res.data);
      onOpenChange(false);
    } catch (e) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" data-testid="settings-sheet">
        <SheetHeader>
          <SheetTitle className="font-display">Rate Settings</SheetTitle>
          <SheetDescription className="text-xs">
            Configure surcharges, taxes and margin applied to every quote.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {settings && (
            <>
              <div className="text-[10px] tracking-[0.25em] uppercase text-slate-500 pb-1 border-b border-slate-200">DHL settings</div>
              {FIELDS.filter(f => f.group === "DHL").map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key} className="text-xs tracking-wider uppercase text-slate-600">
                    {f.label}
                  </Label>
                  <Input
                    id={f.key}
                    type="number"
                    step={f.step}
                    value={settings[f.key]}
                    onChange={(e) =>
                      setSettings({...settings, [f.key]: parseFloat(e.target.value) || 0})
                    }
                    className="rounded-sm h-10 border-slate-300 font-mono"
                    data-testid={`settings-${f.key}-input`}
                  />
                </div>
              ))}
              <div className="text-[10px] tracking-[0.25em] uppercase text-slate-500 pb-1 border-b border-slate-200 pt-3">FedEx defaults</div>
              {FIELDS.filter(f => f.group === "FedEx").map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key} className="text-xs tracking-wider uppercase text-slate-600">
                    {f.label}
                  </Label>
                  <Input
                    id={f.key}
                    type="number"
                    step={f.step}
                    value={settings[f.key]}
                    onChange={(e) =>
                      setSettings({...settings, [f.key]: parseFloat(e.target.value) || 0})
                    }
                    className="rounded-sm h-10 border-slate-300 font-mono"
                    data-testid={`settings-${f.key}-input`}
                  />
                </div>
              ))}
              <div className="text-[10px] tracking-[0.25em] uppercase text-slate-500 pb-1 border-b border-slate-200 pt-3">SELF defaults</div>
              {FIELDS.filter(f => f.group === "SELF").map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key} className="text-xs tracking-wider uppercase text-slate-600">
                    {f.label}
                  </Label>
                  <Input
                    id={f.key}
                    type="number"
                    step={f.step}
                    value={settings[f.key]}
                    onChange={(e) =>
                      setSettings({...settings, [f.key]: parseFloat(e.target.value) || 0})
                    }
                    className="rounded-sm h-10 border-slate-300 font-mono"
                    data-testid={`settings-${f.key}-input`}
                  />
                </div>
              ))}
              <div className="text-[10px] tracking-[0.25em] uppercase text-slate-500 pb-1 border-b border-slate-200 pt-3">UPS defaults</div>
              {FIELDS.filter(f => f.group === "UPS").map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key} className="text-xs tracking-wider uppercase text-slate-600">
                    {f.label}
                  </Label>
                  <Input
                    id={f.key}
                    type="number"
                    step={f.step}
                    value={settings[f.key]}
                    onChange={(e) =>
                      setSettings({...settings, [f.key]: parseFloat(e.target.value) || 0})
                    }
                    className="rounded-sm h-10 border-slate-300 font-mono"
                    data-testid={`settings-${f.key}-input`}
                  />
                </div>
              ))}
            </>
          )}
        </div>

        <SheetFooter className="mt-8">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-sm"
            data-testid="settings-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={saving || !settings}
            className="rounded-sm bg-slate-900 hover:bg-slate-800"
            data-testid="settings-save-btn"
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

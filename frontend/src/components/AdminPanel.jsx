import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "./ui/tabs";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Lock, Settings2, Globe, Activity as ActivityIcon, ShieldCheck, Save } from "lucide-react";
import CountryTable from "./CountryTable";
import ActivityPanel from "./ActivityPanel";

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
  { key: "fedex_ess_rate", label: "FedEx · ADD-ESS per kg (₹)", step: "0.01", group: "FedEx" },
  { key: "fedex_fuel_surcharge_pct", label: "FedEx · ADD-FS %", step: "0.01", group: "FedEx" },
  { key: "fedex_gst_pct", label: "FedEx · GST %", step: "0.01", group: "FedEx" },
  { key: "fedex_local_per_kg", label: "FedEx · Local per kg (₹)", step: "0.01", group: "FedEx" },
  { key: "fedex_margin", label: "FedEx · Margin flat (≤ threshold) (₹)", step: "0.01", group: "FedEx" },
  { key: "fedex_margin_per_kg_over_threshold", label: "FedEx · Margin per kg (> threshold) (₹)", step: "1", group: "FedEx" },
  { key: "fedex_margin_threshold_kg", label: "FedEx · Margin threshold (kg)", step: "1", group: "FedEx" },
  { key: "fedex_clearance_charge", label: "FedEx · Clearance Charge (₹) · commercial only", step: "0.01", group: "FedEx" },
  { key: "self_fuel_surcharge_pct", label: "SELF · Fuel Surcharge %", step: "0.01", group: "SELF" },
  { key: "self_gst_pct", label: "SELF · GST %", step: "0.01", group: "SELF" },
  { key: "self_local_per_kg", label: "SELF · Local per kg (₹)", step: "0.01", group: "SELF" },
  { key: "self_margin", label: "SELF · Margin flat (≤ threshold) (₹)", step: "1", group: "SELF" },
  { key: "self_margin_per_kg_over_threshold", label: "SELF · Margin per kg (> threshold) (₹)", step: "1", group: "SELF" },
  { key: "self_margin_threshold_kg", label: "SELF · Margin threshold (kg)", step: "1", group: "SELF" },
  { key: "ups_fuel_surcharge_pct", label: "UPS · Fuel Surcharge %", step: "0.01", group: "UPS" },
  { key: "ups_gst_pct", label: "UPS · GST %", step: "0.01", group: "UPS" },
  { key: "ups_local_per_kg", label: "UPS · Local per kg (₹)", step: "0.01", group: "UPS" },
  { key: "ups_margin", label: "UPS · Margin flat (≤ threshold) (₹)", step: "1", group: "UPS" },
  { key: "ups_margin_per_kg_over_threshold", label: "UPS · Margin per kg (> threshold) (₹)", step: "1", group: "UPS" },
  { key: "ups_margin_threshold_kg", label: "UPS · Margin threshold (kg)", step: "1", group: "UPS" },
];

function SettingsForm({ onSaved }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get("/settings").then((r) => setSettings(r.data)).catch(() => toast.error("Failed to load settings"));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put("/settings", settings);
      setSettings(res.data);
      toast.success("Settings updated — recalculate to see new rates");
      onSaved?.();
    } catch (e) {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!settings) return <div className="text-sm text-slate-500 py-8 text-center">Loading…</div>;

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] tracking-[0.25em] uppercase text-slate-500 pb-1 border-b border-slate-200">DHL settings</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          {FIELDS.filter(f => f.group === "DHL").map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key} className="text-xs tracking-wider uppercase text-slate-600">{f.label}</Label>
              <Input
                id={f.key}
                type="number"
                step={f.step}
                value={settings[f.key]}
                onChange={(e) => setSettings({ ...settings, [f.key]: parseFloat(e.target.value) || 0 })}
                className="rounded-sm h-10 border-slate-300 font-mono"
                data-testid={`settings-${f.key}-input`}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] tracking-[0.25em] uppercase text-slate-500 pb-1 border-b border-slate-200 pt-3">FedEx defaults</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          {FIELDS.filter(f => f.group === "FedEx").map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key} className="text-xs tracking-wider uppercase text-slate-600">{f.label}</Label>
              <Input
                id={f.key}
                type="number"
                step={f.step}
                value={settings[f.key]}
                onChange={(e) => setSettings({ ...settings, [f.key]: parseFloat(e.target.value) || 0 })}
                className="rounded-sm h-10 border-slate-300 font-mono"
                data-testid={`settings-${f.key}-input`}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] tracking-[0.25em] uppercase text-slate-500 pb-1 border-b border-slate-200 pt-3">SELF defaults</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          {FIELDS.filter(f => f.group === "SELF").map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key} className="text-xs tracking-wider uppercase text-slate-600">{f.label}</Label>
              <Input
                id={f.key}
                type="number"
                step={f.step}
                value={settings[f.key]}
                onChange={(e) => setSettings({ ...settings, [f.key]: parseFloat(e.target.value) || 0 })}
                className="rounded-sm h-10 border-slate-300 font-mono"
                data-testid={`settings-${f.key}-input`}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] tracking-[0.25em] uppercase text-slate-500 pb-1 border-b border-slate-200 pt-3">UPS defaults</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
          {FIELDS.filter(f => f.group === "UPS").map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label htmlFor={f.key} className="text-xs tracking-wider uppercase text-slate-600">{f.label}</Label>
              <Input
                id={f.key}
                type="number"
                step={f.step}
                value={settings[f.key]}
                onChange={(e) => setSettings({ ...settings, [f.key]: parseFloat(e.target.value) || 0 })}
                className="rounded-sm h-10 border-slate-300 font-mono"
                data-testid={`settings-${f.key}-input`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4">
        <Button onClick={save} disabled={saving} className="rounded-sm bg-slate-900 hover:bg-slate-800" data-testid="settings-save-btn">
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminPanel({ open, onOpenChange, countries, onSettingsSaved }) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Lock again whenever the panel closes
  useEffect(() => {
    if (!open) {
      setUnlocked(false);
      setPassword("");
    }
  }, [open]);

  const verify = async (e) => {
    e?.preventDefault();
    if (!password) return toast.error("Enter admin password");
    setVerifying(true);
    try {
      await api.post("/auth/verify-admin-password", { password });
      setUnlocked(true);
      toast.success("Admin panel unlocked");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Incorrect password");
      setPassword("");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-3xl overflow-y-auto" data-testid="admin-panel">
        <SheetHeader>
          <SheetTitle className="font-display flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-900" />
            Admin Panel
          </SheetTitle>
          <SheetDescription className="text-xs">
            {unlocked
              ? "Unlocked · Settings, Zones and Activity are available."
              : "Password-protected · Re-enter your admin password to unlock."}
          </SheetDescription>
        </SheetHeader>

        {!unlocked ? (
          <form onSubmit={verify} className="mt-10 max-w-sm mx-auto space-y-4" data-testid="admin-password-form">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-sm bg-slate-900 text-white flex items-center justify-center">
                <Lock className="w-7 h-7" />
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs tracking-[0.25em] uppercase text-slate-500">Protected area</div>
              <div className="font-display text-lg text-slate-900 mt-1">Enter admin password</div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-pwd" className="text-xs tracking-wider uppercase text-slate-600">Admin password</Label>
              <Input
                id="admin-pwd"
                type="password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-sm h-11 border-slate-300"
                data-testid="admin-password-input"
              />
            </div>
            <Button type="submit" disabled={verifying} className="w-full h-11 rounded-sm bg-slate-900 hover:bg-slate-800" data-testid="admin-password-submit">
              <Lock className="w-4 h-4 mr-2" />
              {verifying ? "Verifying…" : "Unlock"}
            </Button>
            <div className="text-[11px] text-slate-500 text-center pt-2">
              Settings, Zones and Activity are all protected by the same password.
            </div>
          </form>
        ) : (
          <Tabs defaultValue="settings" className="mt-6" data-testid="admin-tabs">
            <TabsList className="rounded-sm bg-slate-100 p-1 h-auto">
              <TabsTrigger value="settings" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white px-4 py-1.5 text-xs tracking-wider uppercase" data-testid="admin-tab-settings">
                <Settings2 className="w-3.5 h-3.5 mr-2" />
                Settings
              </TabsTrigger>
              <TabsTrigger value="zones" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white px-4 py-1.5 text-xs tracking-wider uppercase" data-testid="admin-tab-zones">
                <Globe className="w-3.5 h-3.5 mr-2" />
                Zones
              </TabsTrigger>
              <TabsTrigger value="activity" className="rounded-sm data-[state=active]:bg-slate-900 data-[state=active]:text-white px-4 py-1.5 text-xs tracking-wider uppercase" data-testid="admin-tab-activity">
                <ActivityIcon className="w-3.5 h-3.5 mr-2" />
                Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="mt-5">
              <SettingsForm onSaved={onSettingsSaved} />
            </TabsContent>
            <TabsContent value="zones" className="mt-5">
              <CountryTable countries={countries || []} />
            </TabsContent>
            <TabsContent value="activity" className="mt-5">
              <ActivityPanel />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

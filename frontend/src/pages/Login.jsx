import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Lock, Plane } from "lucide-react";

const LOGIN_BG =
  "https://static.prod-images.emergentagent.com/jobs/489c1699-5f81-40b1-99d0-8ece1d53fcdb/images/8ac90d8c3d16865daf27b99695455887ee3f85d97c59e92c3ce7f17248522bbe.png";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      toast.success("Welcome back");
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2" data-testid="login-page">
      {/* Left panel */}
      <div
        className="hidden lg:flex relative items-end p-12 text-white"
        style={{
          backgroundImage: `linear-gradient(135deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.7) 50%, rgba(37,99,235,0.55) 100%), url(${LOGIN_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-md space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-white/10 backdrop-blur flex items-center justify-center border border-white/20">
              <Plane className="w-5 h-5" />
            </div>
            <span className="text-xs tracking-[0.3em] uppercase text-white/70">Aeriindia Calculator</span>
          </div>
          <h1 className="font-display text-4xl lg:text-5xl leading-tight">
            Ship the world.
            <br />
            <span className="text-blue-300">Priced in seconds.</span>
          </h1>
          <p className="text-sm text-white/70 leading-relaxed">
            Instant DHL export quotes across 230+ countries. Zone-based rates, real
            surcharges, transparent breakdowns — built for AERI customers.
          </p>
          <div className="pt-8 text-xs tracking-wider uppercase text-white/50">
            Authorised access only
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex items-center justify-center p-6 md:p-12 bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="w-9 h-9 rounded-sm bg-slate-900 text-white flex items-center justify-center">
              <Plane className="w-4 h-4" />
            </div>
            <span className="text-xs tracking-[0.3em] uppercase text-slate-500">Aeriindia Calculator</span>
          </div>

          <div className="mb-8">
            <div className="text-xs tracking-[0.25em] uppercase text-slate-500 mb-3">
              Aeriindia Calculator
            </div>
            <h2 className="font-display text-3xl text-slate-900">Sign in</h2>
            <p className="text-sm text-slate-500 mt-2">
              Enter your credentials to access the DHL rate calculator.
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-5" data-testid="login-form">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs tracking-wider uppercase text-slate-600">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@aeriindia.in"
                className="rounded-sm h-11 border-slate-300 focus-visible:ring-blue-500"
                data-testid="login-email-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs tracking-wider uppercase text-slate-600">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="rounded-sm h-11 border-slate-300 focus-visible:ring-blue-500"
                data-testid="login-password-input"
              />
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-sm bg-slate-900 hover:bg-slate-800 text-white transition-colors"
              data-testid="login-submit-button"
            >
              <Lock className="w-4 h-4 mr-2" />
              {submitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-10 pt-6 border-t border-slate-200 text-xs text-slate-400">
            Default access is provisioned by AERI. Contact your admin to request
            credentials.
          </div>
        </div>
      </div>
    </div>
  );
}

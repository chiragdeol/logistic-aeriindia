# AERI Logistics Rate Calculator — PRD

## Original problem
"Run my logistic calculator" — restored from `logistic-New-main.zip` (FastAPI + React + MongoDB), DHL & FedEx zone-based pricing for AERI India.

## Stack
- Backend: FastAPI + Motor (MongoDB) — `/app/backend/server.py`
- Frontend: React + Tailwind + shadcn/ui — `/app/frontend/src`
- Auth: JWT, bcrypt; seeded admin & user
- Data: `rate_data.json` (DHL), `fedex_data.json` (FedEx)

## Personas
- Admin — manages rate settings, views activity, full calculator access
- User — calculator only

## Implemented
- 2026-01: Codebase restored & running under supervisor
- 2026-01: Fixed `isAdmin is not defined` bug in Dashboard.jsx
- 2026-01: Upgraded to newer version (adds AdminPanel, Compare DHL+FedEx, etc.)
- 2026-01: DHL ESS Fee logic
  - ≤ 30 kg: ESS = ess_per_kg × weight (default ₹30/kg)
  - > 30 kg: ESS = zone per-kg rate + ₹30 (flat one-time, not × weight)
- 2026-01: Removed purple gradient on "Compare DHL + FedEx" button (now solid slate-900)
- 2026-01: Verified admin Settings → /api/calculate reads latest values on every request

## Test credentials
- Admin: admin@aeriindia.in / Aeri@2026
- User : user@aeriindia.in / aeri123

## Backlog / future
- Email/PDF quote export from breakdown
- Per-customer margin overrides
- Dashboard analytics (top destinations, monthly volume)

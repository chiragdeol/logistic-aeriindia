from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import logging
import math
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import uuid

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB fallback configuration
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'aeri_logistics')

client = None
db = None

try:
    client = AsyncIOMotorClient(mongo_url, serverSelectionTimeoutMS=2000)
    db = client[db_name]
except Exception as e:
    logging.getLogger(__name__).warning(f"Could not initialize MongoDB client: {e}. Will fallback to mock.")

LOCAL_DB_FILE = ROOT_DIR / 'local_db.json'

async def load_mock_data():
    if not LOCAL_DB_FILE.exists():
        return
    try:
        with open(LOCAL_DB_FILE, 'r') as f:
            data = json.load(f)
        for col_name, docs in data.items():
            if docs:
                await db[col_name].insert_many(docs)
        logging.getLogger(__name__).info(f"Loaded persistent data from {LOCAL_DB_FILE}")
    except Exception as e:
        logging.getLogger(__name__).error(f"Failed to load mock data: {e}")

async def save_mock_data():
    global client, db
    try:
        # Check if using AsyncMongoMockClient without importing it directly if not needed
        if client.__class__.__name__ != 'AsyncMongoMockClient':
            return
        data = {}
        for col_name in ['users', 'settings', 'activity']:
            docs = await db[col_name].find({}, {'_id': 0}).to_list(length=None)
            data[col_name] = docs
        with open(LOCAL_DB_FILE, 'w') as f:
            json.dump(data, f, indent=2)
        logging.getLogger(__name__).info(f"Saved persistent data to {LOCAL_DB_FILE}")
    except Exception as e:
        logging.getLogger(__name__).error(f"Failed to save mock data: {e}")


# Load DHL rate data
with open(ROOT_DIR / 'rate_data.json') as f:
    RATE_DATA = json.load(f)

COUNTRIES = RATE_DATA['countries']          # [{name, code, zone}]
COUNTRY_BY_CODE = {c['code']: c for c in COUNTRIES}
DOC_RATES = {float(k): v for k, v in RATE_DATA['doc_rates'].items()}      # kg -> [z1..z14]
NONDOC_RATES = {float(k): v for k, v in RATE_DATA['nondoc_rates'].items()}
MULTIPLIER = RATE_DATA['multiplier']        # [{from, to, rates[14]}]

# Load FedEx rate data
with open(ROOT_DIR / 'fedex_data.json') as f:
    FEDEX_DATA = json.load(f)
FEDEX_ZONES = FEDEX_DATA['zones']           # ['A'..'Q']
FEDEX_COUNTRIES = FEDEX_DATA['countries']    # [{name, zone}]
FEDEX_COUNTRY_BY_NAME = {c['name'].lower(): c for c in FEDEX_COUNTRIES}
FEDEX_ENVELOPE = {float(k): v for k, v in FEDEX_DATA['envelope_rates'].items()}
FEDEX_PACKAGE = {float(k): v for k, v in FEDEX_DATA['package_rates'].items()}
FEDEX_MULTIPLIER = FEDEX_DATA['multiplier']
FEDEX_DEMAND_MAP = FEDEX_DATA['demand_surcharge']

# Load SELF rate data
with open(ROOT_DIR / 'self_rates.json') as f:
    SELF_RATES = json.load(f)
with open(ROOT_DIR / 'self_au_food_zones.json') as f:
    SELF_AU_FOOD_ZONES = json.load(f)
with open(ROOT_DIR / 'self_au_nonfood_zones.json') as f:
    SELF_AU_NONFOOD_ZONES = json.load(f)
with open(ROOT_DIR / 'self_nz_zones.json') as f:
    SELF_NZ_ZONES = json.load(f)
with open(ROOT_DIR / 'self_ca_zones.json') as f:
    SELF_CA_ZONES = json.load(f)

# Load UPS rate data
with open(ROOT_DIR / 'ups_rates.json') as f:
    UPS_RATES = json.load(f)
with open(ROOT_DIR / 'ups_zone_map.json') as f:
    UPS_ZONE_MAP = json.load(f)

# Auth config
JWT_SECRET = os.environ.get('JWT_SECRET', 'aeri-logistics-secret-change-me-2026')
JWT_ALGO = 'HS256'
JWT_EXPIRES_HOURS = 24

app = FastAPI()
api_router = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)


# ===================== Models =====================
class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    email: str
    role: str


class Country(BaseModel):
    name: str
    code: str
    zone: int


class CalcRequest(BaseModel):
    country_code: str
    weight_kg: float = Field(gt=0, le=99999)
    shipment_type: str = Field(pattern="^(document|nondocument)$")
    customer_name: str = Field(min_length=1, max_length=120)
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None


class RateBreakdown(BaseModel):
    country: Country
    actual_weight: float
    volumetric_weight: float
    chargeable_weight: float
    shipment_type: str
    zone: int
    base_rate: float
    base_per_kg: Optional[float] = None       # only set for >30 kg (multiplier rate per kg)
    heavy_carton_surcharge: float = 0.0
    gulf_surcharge: float = 0.0
    ess_per_kg: float
    ess_fee: float
    subtotal_1: float
    fuel_surcharge_pct: float
    fuel_surcharge: float
    subtotal_2: float
    gst_pct: float
    gst: float
    subtotal_3: float
    local_charge: float
    margin: float
    margin_rule: str
    total: float
    per_kg_mode: bool = False                  # True when >30 kg → all rate rows above are per-kg
    total_per_kg: Optional[float] = None       # only set when per_kg_mode = True
    notes: List[str] = []


class Settings(BaseModel):
    # DHL — new formula model
    ess_per_kg: float = 30.0                   # ESS = ess_per_kg × weight (≤ 30 kg). Above 30 kg, ESS is rolled into per-kg base rate.
    fuel_surcharge_pct: float = 47.75
    gst_pct: float = 18.0
    local_min_charge: float = 120.0            # local up to local_threshold_kg
    local_per_kg: float = 12.0                 # local = max(min, per_kg × weight)
    local_threshold_kg: float = 10.0
    margin_flat: float = 1500.0                # margin if weight ≤ margin_threshold_kg
    margin_per_kg_over_threshold: float = 30.0  # else: per_kg × weight
    margin_threshold_kg: float = 30.0
    volumetric_divisor: float = 5000.0
    gulf_surcharge: float = 4680.0
    heavy_carton_surcharge: float = 3540.0
    # FedEx (admin-configurable defaults; some fields editable per-quote on the form)
    fedex_ess_rate: float = 94.0          # ADD-ESS rate (now per kg)
    fedex_ess_qty: float = 15.0           # default qty multiplier (deprecated)
    fedex_fuel_surcharge_pct: float = 46.5
    fedex_gst_pct: float = 18.0
    fedex_local_charge: float = 180.0     # flat local charge (deprecated)
    fedex_local_per_kg: float = 12.0      # local charge per kg
    fedex_margin: float = 1500.0          # flat margin (₹) for FedEx (≤ threshold)
    fedex_margin_per_kg_over_threshold: float = 30.0  # margin per kg over threshold
    fedex_margin_threshold_kg: float = 30.0           # threshold weight for per-kg margin
    fedex_clearance_charge: float = 2500.0
    # SELF defaults
    self_fuel_surcharge_pct: float = 0.0
    self_gst_pct: float = 18.0
    self_local_per_kg: float = 12.0
    self_margin: float = 1500.0
    self_margin_per_kg_over_threshold: float = 30.0
    self_margin_threshold_kg: float = 30.0
    # UPS defaults
    ups_fuel_surcharge_pct: float = 50.25
    ups_gst_pct: float = 18.0
    ups_local_per_kg: float = 12.0
    ups_margin: float = 1500.0
    ups_margin_per_kg_over_threshold: float = 30.0
    ups_margin_threshold_kg: float = 30.0


class FedexCountry(BaseModel):
    name: str
    zone: str


class FedexCalcRequest(BaseModel):
    country: str                          # name (FedEx mapping is by name)
    weight_kg: float = Field(gt=0, le=99999)
    service: str = Field(pattern="^(envelope|package)$")
    customer_name: str = Field(min_length=1, max_length=120)
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    ess_rate: Optional[float] = None
    ess_qty: Optional[float] = None
    fuel_surcharge_pct: Optional[float] = None
    margin: Optional[float] = None


class SelfCountry(BaseModel):
    name: str
    code: str
    zone: Optional[str] = None


class SelfCalcRequest(BaseModel):
    country_code: str
    weight_kg: float = Field(gt=0, le=99999)
    service_code: str
    customer_name: str = Field(min_length=1, max_length=120)
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    postcode: Optional[str] = None
    suburb: Optional[str] = None


class SelfBreakdown(BaseModel):
    country: SelfCountry
    actual_weight: float
    volumetric_weight: float
    chargeable_weight: float
    service_code: str
    destination: str
    zone: Optional[str] = None
    base_rate: float
    subtotal_1: float
    fuel_surcharge_pct: float
    fuel_surcharge: float
    subtotal_2: float
    gst_pct: float
    gst: float
    subtotal_3: float
    local_charge: float
    margin: float
    total: float
    per_kg_mode: bool = False
    total_per_kg: Optional[float] = None
    notes: List[str] = []


class UpsCountry(BaseModel):
    name: str
    code: str
    zone: Optional[str] = None


class UpsCalcRequest(BaseModel):
    country_code: str
    weight_kg: float = Field(gt=0, le=99999)
    shipment_type: str = Field(pattern="^(document|nondocument)$")
    customer_name: str = Field(min_length=1, max_length=120)
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None


class UpsBreakdown(BaseModel):
    country: UpsCountry
    actual_weight: float
    volumetric_weight: float
    chargeable_weight: float
    shipment_type: str
    zone: Optional[str] = None
    base_rate: float
    subtotal_1: float
    fuel_surcharge_pct: float
    fuel_surcharge: float
    subtotal_2: float
    gst_pct: float
    gst: float
    subtotal_3: float
    local_charge: float
    margin: float
    total: float
    per_kg_mode: bool = False
    total_per_kg: Optional[float] = None
    notes: List[str] = []


class ActivityEntry(BaseModel):
    id: str
    user_email: str
    user_role: str
    customer_name: Optional[str] = None
    carrier: str             # 'dhl' | 'fedex'
    country_name: str
    country_code: str
    zone: str                # str so it works for FedEx zone letters
    weight_kg: float
    chargeable_weight: float
    shipment_type: Optional[str] = None  # 'document' / 'nondocument' / 'envelope' / 'package'
    total: float
    timestamp: str


class FedexBreakdown(BaseModel):
    country: FedexCountry
    actual_weight: float
    volumetric_weight: float
    chargeable_weight: float
    service: str
    zone: str
    base_rate: float
    demand_surcharge: float
    ess_rate: float
    ess_qty: float
    ess_fee: float
    subtotal_1: float
    fuel_surcharge_pct: float
    fuel_surcharge: float
    subtotal_2: float
    gst_pct: float
    gst: float
    subtotal_3: float
    local_charge: float
    clearance_charge: float = 0.0
    margin: float
    total: float
    per_kg_mode: bool = False
    total_per_kg: Optional[float] = None
    notes: List[str] = []


# ===================== Auth =====================
def create_token(email: str) -> str:
    payload = {
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRES_HOURS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    """Returns dict {'email', 'role'} from token + DB lookup."""
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
        email = payload.get("email")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"email": email}, {"_id": 0, "email": 1, "role": 1})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"email": user["email"], "role": user.get("role", "user")}


async def require_admin(user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def seed_admin():
    """Seed default admin + customer user if not exists. Idempotent."""
    seeds = [
        {"email": "admin@aeriindia.in", "password": b"Aeri@2026", "role": "admin"},
        {"email": "user@aeriindia.in",  "password": b"aeri123",   "role": "user"},
    ]
    for s in seeds:
        existing = await db.users.find_one({"email": s["email"]}, {"_id": 0})
        if not existing:
            pw_hash = bcrypt.hashpw(s["password"], bcrypt.gensalt()).decode('utf-8')
            await db.users.insert_one({
                "email": s["email"],
                "password_hash": pw_hash,
                "role": s["role"],
                "created_at": datetime.now(timezone.utc).isoformat(),
            })


async def log_activity(user: dict, carrier: str, country_name: str, country_code: str,
                       zone, weight_kg: float, chargeable_weight: float,
                       shipment_type: Optional[str], total: float,
                       customer_name: Optional[str] = None):
    doc = {
        "id": str(uuid.uuid4()),
        "user_email": user["email"],
        "user_role": user.get("role", "user"),
        "customer_name": customer_name,
        "carrier": carrier,
        "country_name": country_name,
        "country_code": country_code,
        "zone": str(zone),
        "weight_kg": weight_kg,
        "chargeable_weight": chargeable_weight,
        "shipment_type": shipment_type,
        "total": total,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.activity.insert_one(doc)
    await save_mock_data()


async def seed_settings():
    """Always reconcile settings doc with the current Settings model (drops removed fields, adds new defaults)."""
    existing = await db.settings.find_one({"_key": "global"}, {"_id": 0, "_key": 0}) or {}
    valid_keys = set(Settings.model_fields.keys())
    cleaned = {k: v for k, v in existing.items() if k in valid_keys}
    merged = {**Settings(**cleaned).model_dump()}  # fills defaults for missing keys
    merged["_key"] = "global"
    await db.settings.replace_one({"_key": "global"}, merged, upsert=True)


async def get_settings() -> Settings:
    doc = await db.settings.find_one({"_key": "global"}, {"_id": 0, "_key": 0}) or {}
    valid_keys = set(Settings.model_fields.keys())
    cleaned = {k: v for k, v in doc.items() if k in valid_keys}
    return Settings(**cleaned)


# ===================== Routes =====================
@api_router.get("/")
async def root():
    return {"service": "AERI Logistics Rate Calculator", "status": "ok"}


@api_router.post("/auth/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email.lower().strip()}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not bcrypt.checkpw(req.password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user['email'])
    return LoginResponse(token=token, email=user['email'], role=user.get('role', 'user'))


class AdminPasswordRequest(BaseModel):
    password: str


@api_router.post("/auth/verify-admin-password")
async def verify_admin_password(req: AdminPasswordRequest, user: dict = Depends(require_admin)):
    """Extra lock on the admin panel: admin must re-enter their password to open Settings/Zones/Activity."""
    row = await db.users.find_one({"email": user["email"]}, {"_id": 0, "password_hash": 1})
    if not row:
        raise HTTPException(status_code=401, detail="User not found")
    if not bcrypt.checkpw(req.password.encode('utf-8'), row['password_hash'].encode('utf-8')):
        raise HTTPException(status_code=401, detail="Incorrect admin password")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


@api_router.get("/countries", response_model=List[Country])
async def list_countries(_: dict = Depends(get_current_user)):
    return COUNTRIES


@api_router.get("/settings", response_model=Settings)
async def fetch_settings(_: dict = Depends(require_admin)):
    return await get_settings()


@api_router.put("/settings", response_model=Settings)
async def update_settings(new: Settings, _: dict = Depends(require_admin)):
    doc = new.model_dump()
    doc["_key"] = "global"
    await db.settings.replace_one({"_key": "global"}, doc, upsert=True)
    await save_mock_data()
    return new


@api_router.get("/activity", response_model=List[ActivityEntry])
async def list_activity(_: dict = Depends(require_admin), limit: int = 200):
    docs = await db.activity.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return docs


def _round_up_weight(weight: float, shipment_type: str) -> float:
    """DHL rounds up to nearest 0.5 kg up to 30 kg, then 1 kg for heavier."""
    if weight <= 30.0:
        return math.ceil(weight * 2) / 2.0
    return math.ceil(weight)


def _lookup_base_rate(weight: float, zone: int, shipment_type: str):
    """Return (base_rate, per_kg_or_None, notes). per_kg is set only for >30 kg."""
    notes = []
    z_idx = zone - 1  # zones 1..14

    if shipment_type == "document" and weight <= 2.0:
        table = DOC_RATES
        weights_sorted = sorted(table.keys())
        slab = next((w for w in weights_sorted if w >= weight), weights_sorted[-1])
        return round(table[slab][z_idx], 2), None, notes

    # Non-document or document > 2.0
    if shipment_type == "document" and weight <= 2.5:
        weight = 2.5
        notes.append("Documents from 2.5 KG use non-document rates.")

    if weight <= 30.0:
        table = NONDOC_RATES
        weights_sorted = sorted(table.keys())
        slab = next((w for w in weights_sorted if w >= weight), weights_sorted[-1])
        return round(table[slab][z_idx], 2), None, notes

    # >30 kg: multiplier per kg × weight (zone-wise)
    for m in MULTIPLIER:
        if m['from'] <= weight <= m['to']:
            per_kg = m['rates'][z_idx]
            return round(per_kg * weight, 2), per_kg, notes
    m = MULTIPLIER[-1]
    return round(m['rates'][z_idx] * weight, 2), m['rates'][z_idx], notes


@api_router.post("/calculate", response_model=RateBreakdown)
async def calculate(req: CalcRequest, user: dict = Depends(get_current_user)):
    country = COUNTRY_BY_CODE.get(req.country_code.upper())
    if not country:
        raise HTTPException(status_code=404, detail="Country not found")

    settings = await get_settings()
    notes: List[str] = []

    # Volumetric weight
    vol_wt = 0.0
    if req.length_cm and req.width_cm and req.height_cm:
        vol_wt = (req.length_cm * req.width_cm * req.height_cm) / settings.volumetric_divisor

    chargeable = max(req.weight_kg, vol_wt)
    if vol_wt > req.weight_kg:
        notes.append(f"Volumetric weight ({vol_wt:.2f} kg) is greater than actual — using volumetric.")

    rounded = _round_up_weight(chargeable, req.shipment_type)
    if rounded != chargeable:
        notes.append(f"Weight rounded up to {rounded} kg per DHL policy.")

    base, per_kg, lookup_notes = _lookup_base_rate(rounded, country['zone'], req.shipment_type)
    notes.extend(lookup_notes)

    # Heavy carton surcharge
    heavy_surcharge = 0.0
    if req.shipment_type == "nondocument" and rounded > 24.0:
        heavy_surcharge = settings.heavy_carton_surcharge
        notes.append(f"Heavy carton surcharge applied: ₹{heavy_surcharge:.2f}.")

    # Gulf destination surcharge (flat per shipment)
    gulf_codes = {"AE", "SA", "OM", "BH", "QA"}
    gulf_extra = 0.0
    if country['code'] in gulf_codes:
        gulf_extra = settings.gulf_surcharge
        notes.append(f"Gulf destination surcharge applied: ₹{gulf_extra:.2f}.")

    if per_kg is not None:
        # ===== > 30 kg : PER-KG MODEL =====
        per_kg_mode = True
        base_pk = round(per_kg, 2)
        ess_pk = round(settings.ess_per_kg, 2)
        subtotal_1_pk = round(base_pk + ess_pk, 2)
        
        fuel_pk = round(subtotal_1_pk * settings.fuel_surcharge_pct / 100.0, 2)
        subtotal_2_pk = round(subtotal_1_pk + fuel_pk, 2)
        
        gst_pk = round(subtotal_2_pk * settings.gst_pct / 100.0, 2)
        subtotal_3_pk = round(subtotal_2_pk + gst_pk, 2)
        
        local_pk = round(settings.local_per_kg, 2)
        margin_pk = round(settings.margin_per_kg_over_threshold, 2)
        total_pk = round(subtotal_3_pk + local_pk + margin_pk, 2)
        
        total = round(total_pk * rounded + heavy_surcharge + gulf_extra, 2)
        
        base = base_pk
        ess = ess_pk
        subtotal_1 = subtotal_1_pk
        fuel = fuel_pk
        subtotal_2 = subtotal_2_pk
        gst = gst_pk
        subtotal_3 = subtotal_3_pk
        local = local_pk
        margin = margin_pk
        margin_rule = f"₹{margin_pk:.0f}/kg (>30 kg)"
        total_per_kg = total_pk
    else:
        # ===== ≤ 30 kg : standard per-shipment model =====
        per_kg_mode = False
        total_per_kg = None
        ess = round(settings.ess_per_kg * rounded, 2)
        subtotal_1 = round(base + heavy_surcharge + gulf_extra + ess, 2)
        fuel = round(subtotal_1 * settings.fuel_surcharge_pct / 100.0, 2)
        subtotal_2 = round(subtotal_1 + fuel, 2)
        gst = round(subtotal_2 * settings.gst_pct / 100.0, 2)
        subtotal_3 = round(subtotal_2 + gst, 2)
        # Local: max(local_min, local_per_kg × weight)
        local = round(max(settings.local_min_charge, settings.local_per_kg * rounded), 2)
        # Margin: flat under threshold
        margin = round(settings.margin_flat, 2)
        margin_rule = f"Flat ₹{settings.margin_flat:.0f} (≤{settings.margin_threshold_kg:.0f} kg)"
        total = round(subtotal_3 + local + margin, 2)

    breakdown = RateBreakdown(
        country=Country(**country),
        actual_weight=req.weight_kg,
        volumetric_weight=round(vol_wt, 2),
        chargeable_weight=rounded,
        shipment_type=req.shipment_type,
        zone=country['zone'],
        base_rate=base,
        base_per_kg=per_kg,
        heavy_carton_surcharge=heavy_surcharge,
        gulf_surcharge=gulf_extra,
        ess_per_kg=settings.ess_per_kg,
        ess_fee=ess,
        subtotal_1=subtotal_1,
        fuel_surcharge_pct=settings.fuel_surcharge_pct,
        fuel_surcharge=fuel,
        subtotal_2=subtotal_2,
        gst_pct=settings.gst_pct,
        gst=gst,
        subtotal_3=subtotal_3,
        local_charge=local,
        margin=margin,
        margin_rule=margin_rule,
        total=total,
        per_kg_mode=per_kg_mode,
        total_per_kg=total_per_kg,
        notes=notes,
    )

    await log_activity(user, "dhl", country['name'], country['code'], country['zone'],
                       req.weight_kg, rounded, req.shipment_type, total,
                       customer_name=req.customer_name)
    return breakdown


# ===================== FedEx =====================
def _fedex_round_weight(weight: float) -> float:
    """FedEx rounds up to nearest 0.5 kg up to 70.5 kg, then 1 kg above."""
    if weight <= 70.5:
        return math.ceil(weight * 2) / 2.0
    return math.ceil(weight)


def _fedex_demand_surcharge(zone: str, weight: float) -> (float, str):
    """Return (surcharge_amount, label). Min ₹85 per shipment."""
    rate_per_kg = 0
    label = "Rest of World"
    for key, entry in FEDEX_DEMAND_MAP.items():
        if zone in entry['zones']:
            rate_per_kg = entry['rate_per_kg']
            label = key.replace('_', ' / ')
            break
    if rate_per_kg == 0:
        # default to ROW
        rate_per_kg = FEDEX_DEMAND_MAP['ROW']['rate_per_kg']
    amount = max(rate_per_kg * weight, 85.0)
    return round(amount, 2), label


def _fedex_lookup_rate(weight: float, zone: str, service: str) -> (float, List[str]):
    notes: List[str] = []
    if zone not in FEDEX_ZONES:
        raise HTTPException(status_code=400, detail=f"FedEx zone '{zone}' not recognised")
    z_idx = FEDEX_ZONES.index(zone)

    if service == "envelope":
        if weight > 2.5:
            notes.append("Envelope max is 2.5 kg — switched to Package rates.")
            service = "package"
        else:
            table = FEDEX_ENVELOPE
            weights_sorted = sorted(table.keys())
            slab = next((w for w in weights_sorted if w >= weight), weights_sorted[-1])
            return table[slab][z_idx], notes

    # Package
    if weight <= 70.5:
        table = FEDEX_PACKAGE
        weights_sorted = sorted(table.keys())
        slab = next((w for w in weights_sorted if w >= weight), weights_sorted[-1])
        return table[slab][z_idx], notes

    # > 70.5 kg use multiplier per kg
    for m in FEDEX_MULTIPLIER:
        if m['from'] <= weight <= m['to']:
            per_kg = m['rates'][z_idx]
            return round(per_kg * weight, 2), notes
    m = FEDEX_MULTIPLIER[-1]
    return round(m['rates'][z_idx] * weight, 2), notes


@api_router.get("/fedex/countries", response_model=List[FedexCountry])
async def fedex_countries(_: dict = Depends(get_current_user)):
    return FEDEX_COUNTRIES


@api_router.post("/fedex/calculate", response_model=FedexBreakdown)
async def fedex_calculate(req: FedexCalcRequest, user: dict = Depends(get_current_user)):
    country = FEDEX_COUNTRY_BY_NAME.get(req.country.lower().strip())
    if not country:
        raise HTTPException(status_code=404, detail="Country not found in FedEx mapping")

    settings = await get_settings()
    notes: List[str] = []

    # Volumetric weight
    vol_wt = 0.0
    if req.length_cm and req.width_cm and req.height_cm:
        vol_wt = (req.length_cm * req.width_cm * req.height_cm) / settings.volumetric_divisor

    chargeable = max(req.weight_kg, vol_wt)
    if vol_wt > req.weight_kg:
        notes.append(f"Volumetric weight ({vol_wt:.2f} kg) is greater than actual — using volumetric.")

    rounded = _fedex_round_weight(chargeable)
    if rounded != chargeable:
        notes.append(f"Weight rounded up to {rounded} kg per FedEx policy.")

    base, lookup_notes = _fedex_lookup_rate(rounded, country['zone'], req.service)
    notes.extend(lookup_notes)

    # Demand surcharge (per kg, region-based) - Disabled per user request
    demand = 0.0

    if req.ess_rate is not None:
        ess_rate = req.ess_rate
    else:
        zone_upper = country['zone'].upper().strip()
        if zone_upper in ("G", "L"):
            ess_rate = 132.0
        elif zone_upper == "E":
            ess_rate = 0.0
        else:
            ess_rate = settings.fedex_ess_rate
    ess_qty = req.ess_qty if req.ess_qty is not None else settings.fedex_ess_qty
    fuel_pct = req.fuel_surcharge_pct if req.fuel_surcharge_pct is not None else settings.fedex_fuel_surcharge_pct
    margin_amt = req.margin if req.margin is not None else settings.fedex_margin
    # Clearance charge - Disabled per user request
    clearance = 0.0
    local_rate = settings.fedex_local_per_kg

    if rounded > settings.fedex_margin_threshold_kg:
        # ===== > 30 kg : PER-KG MODEL =====
        # Every line of the breakdown is computed and shown on a per-kg basis,
        # then multiplied by chargeable weight at the very end.
        per_kg_mode = True
        
        base_pk = round(base / rounded, 2)
        demand_pk = round(demand / rounded, 2)
        base_total_pk = round(base_pk + demand_pk, 2)
        ess_fee_pk = round(ess_rate, 2)
        
        subtotal_1_pk = round(base_total_pk + ess_fee_pk, 2)
        fuel_pk = round(subtotal_1_pk * fuel_pct / 100.0, 2)
        subtotal_2_pk = round(subtotal_1_pk + fuel_pk, 2)
        gst_pk = round(subtotal_2_pk * settings.fedex_gst_pct / 100.0, 2)
        subtotal_3_pk = round(subtotal_2_pk + gst_pk, 2)
        
        local_pk = round(local_rate, 2)
        clearance_pk = round(clearance / rounded, 2)
        margin_pk = round(settings.fedex_margin_per_kg_over_threshold, 2)
        total_pk = round(subtotal_3_pk + local_pk + clearance_pk + margin_pk, 2)

        notes.append(
            f"Above {settings.fedex_margin_threshold_kg:.0f} kg — per-kg model: ₹{total_pk:.2f}/kg × {rounded} kg."
        )

        total = round(total_pk * rounded, 2)

        breakdown = FedexBreakdown(
            country=FedexCountry(**country),
            actual_weight=req.weight_kg,
            volumetric_weight=round(vol_wt, 2),
            chargeable_weight=rounded,
            service=req.service,
            zone=country['zone'],
            base_rate=base_total_pk,
            demand_surcharge=demand_pk,
            ess_rate=ess_rate,
            ess_qty=ess_qty,
            ess_fee=ess_fee_pk,
            subtotal_1=subtotal_1_pk,
            fuel_surcharge_pct=fuel_pct,
            fuel_surcharge=fuel_pk,
            subtotal_2=subtotal_2_pk,
            gst_pct=settings.fedex_gst_pct,
            gst=gst_pk,
            subtotal_3=subtotal_3_pk,
            local_charge=local_pk,
            clearance_charge=clearance_pk,
            margin=margin_pk,
            total=total,
            per_kg_mode=True,
            total_per_kg=total_pk,
            notes=notes,
        )
    else:
        # ===== ≤ 30 kg : standard per-shipment model =====
        per_kg_mode = False
        ess_fee = round(ess_rate * rounded, 2)
        base_total = round(base + demand, 2)
        subtotal_1 = round(base_total + ess_fee, 2)
        fuel = round(subtotal_1 * fuel_pct / 100.0, 2)
        subtotal_2 = round(subtotal_1 + fuel, 2)
        gst = round(subtotal_2 * settings.fedex_gst_pct / 100.0, 2)
        subtotal_3 = round(subtotal_2 + gst, 2)
        local_charge = round(local_rate * rounded, 2)
        total = round(subtotal_3 + local_charge + margin_amt + clearance, 2)

        breakdown = FedexBreakdown(
            country=FedexCountry(**country),
            actual_weight=req.weight_kg,
            volumetric_weight=round(vol_wt, 2),
            chargeable_weight=rounded,
            service=req.service,
            zone=country['zone'],
            base_rate=base_total,
            demand_surcharge=demand,
            ess_rate=ess_rate,
            ess_qty=ess_qty,
            ess_fee=ess_fee,
            subtotal_1=subtotal_1,
            fuel_surcharge_pct=fuel_pct,
            fuel_surcharge=fuel,
            subtotal_2=subtotal_2,
            gst_pct=settings.fedex_gst_pct,
            gst=gst,
            subtotal_3=subtotal_3,
            local_charge=local_charge,
            clearance_charge=clearance,
            margin=margin_amt,
            total=total,
            per_kg_mode=False,
            total_per_kg=None,
            notes=notes,
        )

    await log_activity(user, "fedex", country['name'], country['name'][:3].upper(),
                       country['zone'], req.weight_kg, rounded, req.service, total,
                       customer_name=req.customer_name)
    return breakdown


# ===================== SELF Network Calculator =====================
def _resolve_self_entries(country_code: str):
    matches = []
    cc = country_code.upper().strip()
    for entry in SELF_RATES:
        dest_codes = [x.strip() for x in entry["dest_code"].split(",")]
        if cc == "US" and "PREMIUM GROUND" in entry["service_code"].upper():
            matches.append(entry)
            continue
        if cc == "GB" and entry["dest_code"] in ("ED", "GL", "ST", "NIR", "JE/ GG/ CI", "ISM / ISW"):
            matches.append(entry)
        if cc in dest_codes:
            matches.append(entry)
    return matches


def _resolve_us_premium_zone(postcode: Optional[str]) -> Optional[str]:
    if not postcode:
        return None
    pc_clean = postcode.upper().strip()
    state = None
    if len(pc_clean) == 2 and pc_clean.isalpha():
        state = pc_clean
    else:
        zip_only = "".join(filter(str.isdigit, pc_clean))[:5]
        if not zip_only or len(zip_only) < 3:
            return None
        zip_num = int(zip_only)
        if 1000 <= zip_num <= 2799: state = "MA"
        elif 2800 <= zip_num <= 2999: state = "RI"
        elif 3000 <= zip_num <= 3899: state = "NH"
        elif 3900 <= zip_num <= 4999: state = "ME"
        elif 5000 <= zip_num <= 5999: state = "VT"
        elif 6000 <= zip_num <= 6999: state = "CT"
        elif 7000 <= zip_num <= 8999: state = "NJ"
        elif 10000 <= zip_num <= 14999: state = "NY"
        elif 15000 <= zip_num <= 19699: state = "PA"
        elif 19700 <= zip_num <= 19999: state = "DE"
        elif 20000 <= zip_num <= 20599: state = "DC"
        elif 20600 <= zip_num <= 21999: state = "MD"
        elif 22000 <= zip_num <= 24699: state = "VA"
        elif 27000 <= zip_num <= 28999: state = "NC"
        elif 29000 <= zip_num <= 29999: state = "SC"
        elif 30000 <= zip_num <= 31999: state = "GA"
        elif 32000 <= zip_num <= 34999: state = "FL"
        elif 35000 <= zip_num <= 36999: state = "AL"
        elif 37000 <= zip_num <= 38599: state = "TN"
        elif 40000 <= zip_num <= 42799: state = "KY"
        elif 43000 <= zip_num <= 45999: state = "OH"
        elif 46000 <= zip_num <= 47999: state = "IN"
        elif 48000 <= zip_num <= 49999: state = "MI"
        elif 50000 <= zip_num <= 52899: state = "IA"
        elif 53000 <= zip_num <= 54999: state = "WI"
        elif 55000 <= zip_num <= 56799: state = "MN"
        elif 57000 <= zip_num <= 57799: state = "SD"
        elif 58000 <= zip_num <= 58899: state = "ND"
        elif 60000 <= zip_num <= 62999: state = "IL"
        elif 63000 <= zip_num <= 65899: state = "MO"
        elif 66000 <= zip_num <= 67999: state = "KS"
        elif 70000 <= zip_num <= 71499: state = "LA"
        elif 71600 <= zip_num <= 72999: state = "AR"
        elif 73000 <= zip_num <= 74999: state = "OK"
        elif 75000 <= zip_num <= 79999: state = "TX"
        elif 80000 <= zip_num <= 81699: state = "CO"
        elif 82000 <= zip_num <= 83199: state = "WY"
        elif 83200 <= zip_num <= 83899: state = "ID"
        elif 84000 <= zip_num <= 84799: state = "UT"
        elif 85000 <= zip_num <= 86599: state = "AZ"
        elif 87000 <= zip_num <= 88499: state = "NM"
        elif 88900 <= zip_num <= 89899: state = "NV"
        elif 90000 <= zip_num <= 96199: state = "CA"
        elif 97000 <= zip_num <= 97999: state = "OR"
        elif 98000 <= zip_num <= 99499: state = "WA"
        elif 59000 <= zip_num <= 59999: state = "MT"
    if not state:
        return None
    if state in {"CT", "DC", "NJ", "NY", "RI"}:
        return "USA (CT,DC, NJ, NY, RI)"
    elif state in {"DE", "MA", "MD", "NC", "NH", "PA", "VA"}:
        return "USA (DE,MA, MD, NC, NH, PA, VA)"
    elif state in {"ME", "MI", "OH", "SC", "VT"}:
        return "USA (ME,MI, OH, SC, VT)"
    elif state in {"AL", "FL", "GA", "IL", "IN", "KY", "MO", "TN", "WI"}:
        return "USA (AL,FL, GA, IL, IN, KY, MO, TN, WI SC)"
    elif state in {"IA", "KS", "MN", "ND", "NE", "SD"}:
        return "USA (IA,KS, MN, ND, NE, SD)"
    elif state in {"AR", "CO", "LA", "OK", "TX", "WY"}:
        return "USA (AR,CO, LA, OK, TX, WY)"
    elif state in {"AZ", "CA", "ID", "MT", "NM", "NV", "OR", "UT", "WA"}:
        return "USA (AZ,CA, ID, MT, NM, NV, OR, UT, WA)"
    return None


def _resolve_gb_express_destination(postcode: Optional[str]) -> str:
    if not postcode:
        return "UK EXPRESS"
    pc = postcode.upper().strip()
    if pc.startswith("BT"):
        return "Northern Ireland(BT1-BT99)"
    if pc.startswith(("JE", "GG")):
        return "JERSEY / GUERNSEY / CHANNEL ISLAND"
    if pc.startswith("IM"):
        return "Isle of Man / Wight"
    if pc.startswith("EH"):
        return "Edinburgh"
    if len(pc) > 1 and pc.startswith("G") and pc[1].isdigit():
        return "Glasgow"
    scotland_prefixes = ("AB", "DD", "DG", "FK", "HS", "IV", "KA", "KW", "KY", "ML", "PA", "PH", "TD", "ZE")
    if pc.startswith(scotland_prefixes):
        return "Scotland"
    return "UK EXPRESS"


def _lookup_self_zone(country_code: str, service_code: str, postcode: Optional[str], suburb: Optional[str]) -> Optional[int]:
    cc = country_code.upper().strip()
    sc = service_code.upper().strip()
    pc = str(postcode).strip() if postcode else ""
    sb = str(suburb).strip().lower() if suburb else ""
    
    if cc == "AU":
        if sc == "AU ECONOMY":
            key = f"{pc}_{sb}"
            return SELF_AU_FOOD_ZONES.get(key)
        elif sc == "AU NON FOOD":
            key = f"{pc}_{sb}"
            return SELF_AU_NONFOOD_ZONES.get(key)
    elif cc == "NZ":
        if sc == "NZ ECONOMY":
            key = f"{pc}_{sb}"
            return SELF_NZ_ZONES.get(key)
    elif cc == "CA":
        if sc in ("CA ECONOMY", "CA ECO DUTY PAID"):
            fsa = pc[:3].lower() if len(pc) >= 3 else pc.lower()
            return SELF_CA_ZONES.get(fsa)
    return None


def _self_round_weight(weight: float) -> float:
    return math.ceil(weight * 2) / 2.0


@api_router.post("/self/calculate", response_model=SelfBreakdown)
async def self_calculate(req: SelfCalcRequest, user: dict = Depends(get_current_user)):
    dhl_country = COUNTRY_BY_CODE.get(req.country_code.upper())
    country_name = dhl_country["name"] if dhl_country else req.country_code.upper()
    
    settings = await get_settings()
    notes = []
    
    vol_wt = 0.0
    if req.length_cm and req.width_cm and req.height_cm:
        vol_wt = (req.length_cm * req.width_cm * req.height_cm) / settings.volumetric_divisor
        
    chargeable = max(req.weight_kg, vol_wt)
    if vol_wt > req.weight_kg:
        notes.append(f"Volumetric weight ({vol_wt:.2f} kg) is greater than actual — using volumetric.")
        
    rounded = _self_round_weight(chargeable)
    if rounded != chargeable:
        notes.append(f"Weight rounded up to {rounded} kg per SELF policy.")
        
    entries = _resolve_self_entries(req.country_code)
    if not entries:
        raise HTTPException(status_code=404, detail="Country not supported in SELF network")
        
    filtered_entries = [e for e in entries if e["service_code"].upper() == req.service_code.upper()]
    if not filtered_entries:
        raise HTTPException(status_code=404, detail=f"Service '{req.service_code}' not available for this country in SELF network")
        
    zone = None
    selected_entry = None
    zone_services = ("AU ECONOMY", "AU NON FOOD", "NZ ECONOMY", "CA ECONOMY", "CA ECO DUTY PAID")
    
    if req.service_code.upper() in zone_services:
        zone_val = _lookup_self_zone(req.country_code, req.service_code, req.postcode, req.suburb)
        if zone_val is None:
            raise HTTPException(status_code=400, detail="Invalid postcode or suburb/town name for this destination")
        zone = f"ZONE {zone_val}"
        
        for entry in filtered_entries:
            if str(entry["destination"]).strip().upper() == zone.upper():
                selected_entry = entry
                break
        if not selected_entry:
            raise HTTPException(status_code=404, detail=f"Rates for {zone} not found in SELF rate table")
    elif req.country_code.upper() == "US" and req.service_code.upper() == "PREMIUM GROUND":
        dest_str = _resolve_us_premium_zone(req.postcode)
        if not dest_str:
            raise HTTPException(status_code=400, detail="Invalid US ZIP code or State code")
        zone = dest_str
        for entry in filtered_entries:
            if str(entry["destination"]).strip().upper() == dest_str.upper():
                selected_entry = entry
                break
        if not selected_entry:
            raise HTTPException(status_code=404, detail=f"Rates for {dest_str} not found in SELF rate table")
    elif req.country_code.upper() == "GB" and req.service_code.upper() == "EXPRESS":
        dest_str = _resolve_gb_express_destination(req.postcode)
        zone = dest_str
        for entry in filtered_entries:
            if str(entry["destination"]).strip().upper() == dest_str.upper():
                selected_entry = entry
                break
        if not selected_entry:
            raise HTTPException(status_code=404, detail=f"Rates for {dest_str} not found in SELF rate table")
    else:
        selected_entry = filtered_entries[0]
        
    rate_0_5 = selected_entry["rate_0_5"]
    add_0_5 = selected_entry["add_0_5"]
    
    if selected_entry.get("remark") and "suspend" in str(selected_entry["remark"]).lower():
        raise HTTPException(status_code=400, detail=f"Service suspended: {selected_entry['remark']}")
        
    base_rate = 0.0
    per_kg_mode = False
    total_per_kg = None
    
    if rounded <= 5.5:
        if rate_0_5 is None:
            raise HTTPException(status_code=400, detail="Weight slab not supported for this service")
        if rounded <= 0.5:
            base_rate = rate_0_5
        else:
            if add_0_5 is None:
                raise HTTPException(status_code=400, detail="Weight increment rate not defined for this service")
            increments = (rounded - 0.5) / 0.5
            base_rate = rate_0_5 + increments * add_0_5
    else:
        per_kg_rate = None
        if rounded < 8.0:
            per_kg_rate = selected_entry["rate_6"]
            bracket_label = "6 kg slab"
        elif rounded < 11.0:
            per_kg_rate = selected_entry["rate_8"]
            bracket_label = "8 kg slab"
        elif rounded < 16.0:
            per_kg_rate = selected_entry["rate_11"]
            bracket_label = "11 kg slab"
        elif rounded < 21.0:
            per_kg_rate = selected_entry["rate_16"]
            bracket_label = "16 kg slab"
        elif rounded < 26.0:
            per_kg_rate = selected_entry["rate_21"]
            bracket_label = "21 kg slab"
        else:
            per_kg_rate = selected_entry["rate_26"]
            bracket_label = "26+ kg slab"
            
        if per_kg_rate is None:
            raise HTTPException(status_code=400, detail="Heavy weight slab not supported for this service")
            
        base_rate = per_kg_rate * rounded
        notes.append(f"Using heavy weight bracket: {bracket_label} (₹{per_kg_rate:.2f}/kg).")

    if selected_entry.get("remark"):
        notes.append(f"Remark: {selected_entry['remark']}")
        
    if rounded > settings.self_margin_threshold_kg:
        per_kg_mode = True
        base_pk = round(base_rate / rounded, 2)
        subtotal_1_pk = base_pk
        fuel_pk = round(subtotal_1_pk * settings.self_fuel_surcharge_pct / 100.0, 2)
        subtotal_2_pk = round(subtotal_1_pk + fuel_pk, 2)
        gst_pk = round(subtotal_2_pk * settings.self_gst_pct / 100.0, 2)
        subtotal_3_pk = round(subtotal_2_pk + gst_pk, 2)
        local_pk = round(settings.self_local_per_kg, 2)
        margin_pk = round(settings.self_margin_per_kg_over_threshold, 2)
        total_pk = round(subtotal_3_pk + local_pk + margin_pk, 2)
        
        total = round(total_pk * rounded, 2)
        subtotal_1 = round(subtotal_1_pk * rounded, 2)
        fuel_surcharge = round(fuel_pk * rounded, 2)
        subtotal_2 = round(subtotal_2_pk * rounded, 2)
        gst = round(gst_pk * rounded, 2)
        subtotal_3 = round(subtotal_3_pk * rounded, 2)
        local_charge = round(local_pk * rounded, 2)
        margin_amt = round(margin_pk * rounded, 2)
        total_per_kg = total_pk
    else:
        per_kg_mode = False
        subtotal_1 = round(base_rate, 2)
        fuel_surcharge = round(subtotal_1 * settings.self_fuel_surcharge_pct / 100.0, 2)
        subtotal_2 = round(subtotal_1 + fuel_surcharge, 2)
        gst = round(subtotal_2 * settings.self_gst_pct / 100.0, 2)
        subtotal_3 = round(subtotal_2 + gst, 2)
        local_charge = round(settings.self_local_per_kg * rounded, 2)
        margin_amt = round(settings.self_margin, 2)
        total = round(subtotal_3 + local_charge + margin_amt, 2)
        
    breakdown = SelfBreakdown(
        country=SelfCountry(name=country_name, code=req.country_code.upper(), zone=zone),
        actual_weight=req.weight_kg,
        volumetric_weight=round(vol_wt, 2),
        chargeable_weight=rounded,
        service_code=req.service_code,
        destination=selected_entry["destination"],
        zone=zone,
        base_rate=base_rate,
        subtotal_1=subtotal_1,
        fuel_surcharge_pct=settings.self_fuel_surcharge_pct,
        fuel_surcharge=fuel_surcharge,
        subtotal_2=subtotal_2,
        gst_pct=settings.self_gst_pct,
        gst=gst,
        subtotal_3=subtotal_3,
        local_charge=local_charge,
        margin=margin_amt,
        total=total,
        per_kg_mode=per_kg_mode,
        total_per_kg=total_per_kg,
        notes=notes
    )
    
    await log_activity(user, "self", country_name, req.country_code.upper(),
                       zone or "FLAT", req.weight_kg, rounded, req.service_code, total,
                       customer_name=req.customer_name)
    return breakdown


# ===================== UPS Saver Calculator =====================
def _resolve_ups_column(country_name: str, country_code: str) -> int:
    c_name = country_name.lower().strip()
    c_code = country_code.upper().strip()
    
    mappings = {
        "united states": "usa",
        "united states of america": "usa",
        "us": "usa",
        "united kingdom": "uk",
        "great britain": "uk",
        "gb": "uk",
        "philiphines": "philipines",
        "philippines": "philipines",
        "viet nam": "vietnam",
        "korea": "south korea",
        "republic of korea": "south korea",
    }
    
    c_name_mapped = mappings.get(c_name, c_name)
    
    columns_map = UPS_ZONE_MAP["columns"]
    for col_key, names_list in columns_map.items():
        for name in names_list:
            n_clean = name.lower().strip()
            if c_name_mapped == n_clean or c_code.lower() == n_clean:
                return int(col_key)
                
    zone_guide = UPS_ZONE_MAP["zone_guide"]
    matched_zone = None
    for zone_name, countries_list in zone_guide.items():
        for country in countries_list:
            c_clean = country.lower().strip()
            if c_name_mapped == c_clean:
                matched_zone = zone_name
                break
        if matched_zone:
            break
            
    if matched_zone:
        for col_key, names_list in columns_map.items():
            for name in names_list:
                if matched_zone.upper() == name.upper():
                    return int(col_key)
                    
    return 1


@api_router.post("/ups/calculate", response_model=UpsBreakdown)
async def ups_calculate(req: UpsCalcRequest, user: dict = Depends(get_current_user)):
    dhl_country = COUNTRY_BY_CODE.get(req.country_code.upper())
    country_name = dhl_country["name"] if dhl_country else req.country_code.upper()
    
    settings = await get_settings()
    notes = []
    
    vol_wt = 0.0
    if req.length_cm and req.width_cm and req.height_cm:
        vol_wt = (req.length_cm * req.width_cm * req.height_cm) / settings.volumetric_divisor
        
    chargeable = max(req.weight_kg, vol_wt)
    if vol_wt > req.weight_kg:
        notes.append(f"Volumetric weight ({vol_wt:.2f} kg) is greater than actual — using volumetric.")
        
    rounded = math.ceil(chargeable * 2) / 2.0
    if rounded != chargeable:
        notes.append(f"Weight rounded up to {rounded} kg per UPS policy.")
        
    col_idx = _resolve_ups_column(country_name, req.country_code)
    array_idx = col_idx - 1
    
    col_names = UPS_ZONE_MAP["columns"][str(col_idx)]
    resolved_label = col_names[0] if col_names else f"Col {col_idx}"
    notes.append(f"Resolved destination to UPS rate column: {resolved_label}")
    
    base_rate = 0.0
    per_kg_mode = False
    total_per_kg = None
    
    if rounded <= 20.0:
        if rounded == 20.0:
            rates_list = UPS_RATES["multipliers"].get("20")
            if rates_list:
                base_rate = rates_list[array_idx]
            else:
                raise HTTPException(status_code=400, detail="UPS 20kg rate not found")
        else:
            rates_list = UPS_RATES["rates"].get(str(rounded))
            if not rates_list:
                raise HTTPException(status_code=400, detail=f"UPS weight slab {rounded} kg not found")
                
            if rounded == 0.5:
                if req.shipment_type == "document" and len(rates_list) > 0:
                    base_rate = rates_list[0][array_idx]
                elif len(rates_list) > 1:
                    base_rate = rates_list[1][array_idx]
                else:
                    base_rate = rates_list[0][array_idx]
            else:
                base_rate = rates_list[0][array_idx]
    else:
        if rounded < 30.0:
            key = "20+"
        elif rounded < 50.0:
            key = "30+"
        elif rounded < 70.0:
            key = "50+"
        elif rounded < 100.0:
            key = "70+"
        elif rounded < 300.0:
            key = "100+"
        elif rounded < 500.0:
            key = "300+"
        else:
            key = "500+"
            
        multipliers_list = UPS_RATES["multipliers"].get(key)
        if not multipliers_list:
            raise HTTPException(status_code=400, detail=f"UPS heavy multiplier '{key}' not found")
            
        multiplier_rate = multipliers_list[array_idx]
        base_rate = multiplier_rate * rounded
        notes.append(f"Using heavy weight multiplier: {key} (₹{multiplier_rate:.2f}/kg).")
        
    if rounded > settings.ups_margin_threshold_kg:
        per_kg_mode = True
        if rounded > 20.0:
            # Multiplier model: calculate and round All-In rate per kg to integer first
            all_in_pk = round(multiplier_rate * (1 + settings.ups_fuel_surcharge_pct / 100.0) * (1 + settings.ups_gst_pct / 100.0))
            base_pk = multiplier_rate
            fuel_pk = round(base_pk * settings.ups_fuel_surcharge_pct / 100.0, 2)
            subtotal_2_pk = round(base_pk + fuel_pk, 2)
            gst_pk = all_in_pk - subtotal_2_pk
            subtotal_3_pk = all_in_pk
        else:
            base_pk = round(base_rate / rounded, 2)
            subtotal_1_pk = base_pk
            fuel_pk = round(subtotal_1_pk * settings.ups_fuel_surcharge_pct / 100.0, 2)
            subtotal_2_pk = round(subtotal_1_pk + fuel_pk, 2)
            gst_pk = round(subtotal_2_pk * settings.ups_gst_pct / 100.0, 2)
            subtotal_3_pk = round(subtotal_2_pk + gst_pk, 2)
            
        local_pk = round(settings.ups_local_per_kg, 2)
        margin_pk = round(settings.ups_margin_per_kg_over_threshold, 2)
        total_pk = round(subtotal_3_pk + local_pk + margin_pk, 2)
        
        total = round(total_pk * rounded, 2)
        subtotal_1 = round(base_pk * rounded, 2)
        fuel_surcharge = round(fuel_pk * rounded, 2)
        subtotal_2 = round(subtotal_2_pk * rounded, 2)
        gst = round(gst_pk * rounded, 2)
        subtotal_3 = round(subtotal_3_pk * rounded, 2)
        local_charge = round(local_pk * rounded, 2)
        margin_amt = round(margin_pk * rounded, 2)
        total_per_kg = total_pk
    else:
        per_kg_mode = False
        if rounded > 20.0:
            # Multiplier model: calculate and round All-In rate per kg to integer first
            all_in_cost = round(multiplier_rate * (1 + settings.ups_fuel_surcharge_pct / 100.0) * (1 + settings.ups_gst_pct / 100.0)) * rounded
            subtotal_1 = round(base_rate, 2)
            fuel_surcharge = round(subtotal_1 * settings.ups_fuel_surcharge_pct / 100.0, 2)
            subtotal_2 = round(subtotal_1 + fuel_surcharge, 2)
            gst = all_in_cost - subtotal_2
            subtotal_3 = all_in_cost
        else:
            subtotal_1 = round(base_rate, 2)
            fuel_surcharge = round(subtotal_1 * settings.ups_fuel_surcharge_pct / 100.0, 2)
            subtotal_2 = round(subtotal_1 + fuel_surcharge, 2)
            gst = round(subtotal_2 * settings.ups_gst_pct / 100.0, 2)
            subtotal_3 = round(subtotal_2 + gst, 2)
            
        local_charge = round(settings.ups_local_per_kg * rounded, 2)
        margin_amt = round(settings.ups_margin, 2)
        total = round(subtotal_3 + local_charge + margin_amt, 2)
        
    breakdown = UpsBreakdown(
        country=UpsCountry(name=country_name, code=req.country_code.upper(), zone=resolved_label),
        actual_weight=req.weight_kg,
        volumetric_weight=round(vol_wt, 2),
        chargeable_weight=rounded,
        shipment_type=req.shipment_type,
        zone=resolved_label,
        base_rate=base_rate,
        subtotal_1=subtotal_1,
        fuel_surcharge_pct=settings.ups_fuel_surcharge_pct,
        fuel_surcharge=fuel_surcharge,
        subtotal_2=subtotal_2,
        gst_pct=settings.ups_gst_pct,
        gst=gst,
        subtotal_3=subtotal_3,
        local_charge=local_charge,
        margin=margin_amt,
        total=total,
        per_kg_mode=per_kg_mode,
        total_per_kg=total_per_kg,
        notes=notes
    )
    
    await log_activity(user, "ups", country_name, req.country_code.upper(),
                       resolved_label, req.weight_kg, rounded, req.shipment_type, total,
                       customer_name=req.customer_name)
    return breakdown


# ===================== Combined (both) calculator =====================
def _resolve_fedex_country_by_dhl_name(dhl_name: str):
    """Best-effort mapping from a DHL country name to a FedEx country dict."""
    if not dhl_name:
        return None
    n = dhl_name.lower().strip()
    if n in FEDEX_COUNTRY_BY_NAME:
        return FEDEX_COUNTRY_BY_NAME[n]
    # prefix matches
    for k, v in FEDEX_COUNTRY_BY_NAME.items():
        if k.startswith(n) or n.startswith(k):
            return v
    # contains
    for k, v in FEDEX_COUNTRY_BY_NAME.items():
        if n in k or k in n:
            return v
    return None


class BothCalcRequest(BaseModel):
    country_code: str
    weight_kg: float = Field(gt=0, le=99999)
    shipment_type: str = Field(pattern="^(document|nondocument)$")
    customer_name: str = Field(min_length=1, max_length=120)
    length_cm: Optional[float] = None
    width_cm: Optional[float] = None
    height_cm: Optional[float] = None
    postcode: Optional[str] = None
    suburb: Optional[str] = None


class BothRateResponse(BaseModel):
    customer_name: str
    weight_kg: float
    dhl: Optional[RateBreakdown] = None
    dhl_error: Optional[str] = None
    fedex: Optional[FedexBreakdown] = None
    fedex_error: Optional[str] = None
    self_carrier: Optional[SelfBreakdown] = None
    self_error: Optional[str] = None
    ups: Optional[UpsBreakdown] = None
    ups_error: Optional[str] = None


@api_router.post("/calculate-both", response_model=BothRateResponse)
async def calculate_both(req: BothCalcRequest, user: dict = Depends(get_current_user)):
    """Compute DHL + FedEx + SELF + UPS totals in a single round-trip."""
    resp = BothRateResponse(customer_name=req.customer_name, weight_kg=req.weight_kg)

    # 1. DHL leg
    try:
        dhl_req = CalcRequest(
            country_code=req.country_code,
            weight_kg=req.weight_kg,
            shipment_type=req.shipment_type,
            customer_name=req.customer_name,
            length_cm=req.length_cm,
            width_cm=req.width_cm,
            height_cm=req.height_cm,
        )
        resp.dhl = await calculate(dhl_req, user)
    except HTTPException as e:
        resp.dhl_error = str(e.detail)
    except Exception as e:
        resp.dhl_error = f"DHL calc failed: {e}"

    # 2. FedEx leg
    dhl_country = COUNTRY_BY_CODE.get(req.country_code.upper())
    fedex_country = _resolve_fedex_country_by_dhl_name(dhl_country['name']) if dhl_country else None
    if not fedex_country:
        resp.fedex_error = "No matching FedEx country for this destination"
    else:
        service = "envelope" if req.weight_kg <= 2.5 else "package"
        try:
            fx_req = FedexCalcRequest(
                country=fedex_country['name'],
                weight_kg=req.weight_kg,
                service=service,
                customer_name=req.customer_name,
                length_cm=req.length_cm,
                width_cm=req.width_cm,
                height_cm=req.height_cm,
            )
            resp.fedex = await fedex_calculate(fx_req, user)
        except HTTPException as e:
            resp.fedex_error = str(e.detail)
        except Exception as e:
            resp.fedex_error = f"FedEx calc failed: {e}"

    # 3. SELF leg
    try:
        # Determine service code
        cc = req.country_code.upper().strip()
        service_code = None
        if cc == "AU":
            service_code = "AU NON FOOD" if req.shipment_type == "document" else "AU ECONOMY"
        elif cc == "NZ":
            service_code = "NZ ECONOMY"
        elif cc == "CA":
            service_code = "CA ECONOMY"
        elif cc == "US":
            service_code = "PREMIUM GROUND"
        elif cc == "GB":
            service_code = "EXPRESS"
        else:
            # find first matching service in self rates
            entries = _resolve_self_entries(cc)
            if entries:
                # prefer 'SELF', otherwise use first
                sc_list = [e["service_code"] for e in entries]
                if "SELF" in sc_list:
                    service_code = "SELF"
                else:
                    service_code = sc_list[0]
                    
        if not service_code:
            resp.self_error = "No matching SELF service for this country"
        else:
            self_req = SelfCalcRequest(
                country_code=req.country_code,
                weight_kg=req.weight_kg,
                service_code=service_code,
                customer_name=req.customer_name,
                length_cm=req.length_cm,
                width_cm=req.width_cm,
                height_cm=req.height_cm,
                postcode=req.postcode,
                suburb=req.suburb,
            )
            resp.self_carrier = await self_calculate(self_req, user)
    except HTTPException as e:
        resp.self_error = str(e.detail)
    except Exception as e:
        resp.self_error = f"SELF calc failed: {e}"

    # 4. UPS leg
    try:
        ups_req = UpsCalcRequest(
            country_code=req.country_code,
            weight_kg=req.weight_kg,
            shipment_type=req.shipment_type,
            customer_name=req.customer_name,
            length_cm=req.length_cm,
            width_cm=req.width_cm,
            height_cm=req.height_cm,
        )
        resp.ups = await ups_calculate(ups_req, user)
    except HTTPException as e:
        resp.ups_error = str(e.detail)
    except Exception as e:
        resp.ups_error = f"UPS calc failed: {e}"

    return resp


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def on_startup():
    global client, db
    try:
        if client is not None:
            await client.admin.command('ping')
            logger.info("Connected to MongoDB successfully.")
        else:
            raise Exception("MongoDB client not initialized.")
    except Exception as e:
        logger.warning(f"MongoDB connection check failed: {e}. Falling back to in-memory Mock MongoDB.")
        from mongomock_motor import AsyncMongoMockClient
        client = AsyncMongoMockClient()
        db = client[db_name]
        await load_mock_data()

    await seed_admin()
    await seed_settings()
    await save_mock_data()
    logger.info("AERI rate calculator ready. DHL: %d countries, FedEx: %d countries", len(COUNTRIES), len(FEDEX_COUNTRIES))


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

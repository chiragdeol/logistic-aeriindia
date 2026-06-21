"""Backend API tests for AERI DHL Rate Calculator."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://logistics-rate-calc.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@aeriindia.in"
ADMIN_PASS = "Aeri@2026"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# ===== Auth =====
class TestAuth:
    def test_login_success(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "token" in body and len(body["token"]) > 10
        assert body["email"] == ADMIN_EMAIL

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
        assert r.status_code == 401

    def test_me_with_token(self, auth_headers):
        r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_without_token(self):
        r = requests.get(f"{API}/auth/me", timeout=15)
        assert r.status_code in (401, 403)


# ===== Countries =====
class TestCountries:
    def test_countries_list(self, auth_headers):
        r = requests.get(f"{API}/countries", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 233, f"expected 233, got {len(data)}"
        sample = data[0]
        assert {"name", "code", "zone"}.issubset(sample.keys())

    def test_countries_requires_auth(self):
        r = requests.get(f"{API}/countries", timeout=15)
        assert r.status_code in (401, 403)


# ===== Settings =====
class TestSettings:
    def test_get_settings_defaults(self, auth_headers):
        r = requests.get(f"{API}/settings", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        s = r.json()
        assert s["ess_per_kg"] == 30.0
        assert s["fuel_surcharge_pct"] == 47.75
        assert s["gst_pct"] == 18.0
        assert s["margin_flat"] == 1500.0

    def test_put_settings_persists(self, auth_headers):
        # Update
        orig = requests.get(f"{API}/settings", headers=auth_headers, timeout=15).json()
        new_vals = {**orig, "ess_per_kg": 35.0}
        r = requests.put(f"{API}/settings", headers=auth_headers, json=new_vals, timeout=15)
        assert r.status_code == 200
        assert r.json()["ess_per_kg"] == 35.0
        # Verify persisted
        r2 = requests.get(f"{API}/settings", headers=auth_headers, timeout=15)
        assert r2.json()["ess_per_kg"] == 35.0
        # Restore
        requests.put(f"{API}/settings", headers=auth_headers, json=orig, timeout=15)


# ===== Calculate =====
class TestCalculate:
    def test_calc_usa_5kg_nondoc(self, auth_headers):
        r = requests.post(f"{API}/calculate", headers=auth_headers, json={
            "country_code": "US", "weight_kg": 5, "shipment_type": "nondocument", "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["zone"] == 12
        assert data["country"]["code"] == "US"
        # sanity: total should be positive, has all fields
        for k in ("base_rate", "ess_fee", "fuel_surcharge", "gst", "local_charge", "margin", "total"):
            assert k in data
        assert data["total"] > 0

    def test_calc_uk_05kg_document(self, auth_headers):
        r = requests.post(f"{API}/calculate", headers=auth_headers, json={
            "country_code": "GB", "weight_kg": 0.5, "shipment_type": "document", "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["zone"] == 7
        assert data["chargeable_weight"] == 0.5

    def test_calc_uae_45kg_with_surcharges(self, auth_headers):
        r = requests.post(f"{API}/calculate", headers=auth_headers, json={
            "country_code": "AE", "weight_kg": 45, "shipment_type": "nondocument",
            "length_cm": 30, "width_cm": 30, "height_cm": 30, "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        notes_joined = " ".join(data["notes"]).lower()
        assert "gulf" in notes_joined
        assert "heavy carton" in notes_joined or "4680" in notes_joined or "3540" in notes_joined
        # Both numbers should appear in notes
        assert "4680" in " ".join(data["notes"])
        assert "3540" in " ".join(data["notes"])

    def test_calc_unknown_country(self, auth_headers):
        r = requests.post(f"{API}/calculate", headers=auth_headers, json={
            "country_code": "ZZ", "weight_kg": 1, "shipment_type": "document", "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 404

    def test_calc_volumetric_gt_actual(self, auth_headers):
        # 50x50x50 / 5000 = 25kg volumetric vs 1kg actual
        r = requests.post(f"{API}/calculate", headers=auth_headers, json={
            "country_code": "US", "weight_kg": 1, "shipment_type": "nondocument",
            "length_cm": 50, "width_cm": 50, "height_cm": 50, "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["volumetric_weight"] == 25.0
        assert data["chargeable_weight"] >= 25.0

    def test_calc_over_30kg_uses_multiplier(self, auth_headers):
        r = requests.post(f"{API}/calculate", headers=auth_headers, json={
            "country_code": "US", "weight_kg": 50, "shipment_type": "nondocument", "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["chargeable_weight"] == 50.0
        assert data["total"] > 0
        assert data["per_kg_mode"] is True
        per_kg = data["base_per_kg"]
        assert per_kg is not None
        assert data["subtotal_1"] == round(per_kg + data["ess_per_kg"], 2)

    def test_calc_requires_auth(self):
        r = requests.post(f"{API}/calculate", json={
            "country_code": "US", "weight_kg": 1, "shipment_type": "document", "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code in (401, 403)


# ===== FedEx =====
class TestFedexCountries:
    def test_fedex_countries(self, auth_headers):
        r = requests.get(f"{API}/fedex/countries", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 200, f"expected >=200, got {len(data)}"
        sample = data[0]
        assert {"name", "zone"}.issubset(sample.keys())
        # zone is one of A-Q
        zones = {c["zone"] for c in data}
        assert zones.issubset(set(list("ABCDEFGHIJKLMNOPQ")))
        # USA exists
        names = {c["name"].lower() for c in data}
        assert "usa" in names or "united states" in names

    def test_fedex_countries_requires_auth(self):
        r = requests.get(f"{API}/fedex/countries", timeout=15)
        assert r.status_code in (401, 403)


class TestFedexSettings:
    def test_settings_has_fedex_fields(self, auth_headers):
        r = requests.get(f"{API}/settings", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        s = r.json()
        # DHL fields still present
        assert "ess_per_kg" in s and "fuel_surcharge_pct" in s
        # FedEx defaults
        assert s["fedex_ess_rate"] == 94.0
        assert s["fedex_ess_qty"] == 15.0
        assert s["fedex_fuel_surcharge_pct"] == 46.5
        assert s["fedex_local_charge"] == 180.0
        assert s["fedex_local_per_kg"] == 12.0
        assert s["fedex_margin"] == 1500.0
        assert s["fedex_margin_per_kg_over_threshold"] == 30.0
        assert s["fedex_margin_threshold_kg"] == 30.0
        assert s["fedex_clearance_charge"] == 2500.0

    def test_put_settings_fedex_persists(self, auth_headers):
        orig = requests.get(f"{API}/settings", headers=auth_headers, timeout=15).json()
        new_vals = {**orig, "fedex_ess_rate": 100.0, "fedex_margin": 1800.0}
        r = requests.put(f"{API}/settings", headers=auth_headers, json=new_vals, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert body["fedex_ess_rate"] == 100.0
        assert body["fedex_margin"] == 1800.0
        # verify persisted
        r2 = requests.get(f"{API}/settings", headers=auth_headers, timeout=15).json()
        assert r2["fedex_ess_rate"] == 100.0
        assert r2["fedex_margin"] == 1800.0
        # restore
        requests.put(f"{API}/settings", headers=auth_headers, json=orig, timeout=15)


class TestFedexCalculate:
    def test_fedex_usa_5kg_package(self, auth_headers):
        r = requests.post(f"{API}/fedex/calculate", headers=auth_headers, json={
            "country": "USA", "weight_kg": 5, "service": "package", "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["zone"] == "G"
        for k in ("base_rate", "demand_surcharge", "ess_fee", "fuel_surcharge",
                  "gst", "local_charge", "margin", "total"):
            assert k in d
        assert d["total"] > 0
        # default ess values
        assert d["ess_rate"] == 134.0
        assert d["ess_qty"] == 15.0
        assert d["margin"] == 1500.0
        assert d["fuel_surcharge_pct"] == 46.5

    def test_fedex_uk_envelope(self, auth_headers):
        r = requests.post(f"{API}/fedex/calculate", headers=auth_headers, json={
            "country": "United Kingdom (Great Britain)", "weight_kg": 0.5, "service": "envelope", "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["zone"] == "F"
        assert d["service"] == "envelope"
        assert d["ess_rate"] == 94.0
        assert d["total"] > 0

    def test_fedex_with_overrides(self, auth_headers):
        r = requests.post(f"{API}/fedex/calculate", headers=auth_headers, json={
            "country": "USA", "weight_kg": 5, "service": "package",
            "ess_rate": 100, "ess_qty": 10, "fuel_surcharge_pct": 50, "margin": 2000, "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ess_rate"] == 100
        assert d["ess_qty"] == 10
        assert d["fuel_surcharge_pct"] == 50
        assert d["margin"] == 2000
        assert d["ess_fee"] == 500  # 100 * 5

    def test_fedex_75kg_multiplier(self, auth_headers):
        r = requests.post(f"{API}/fedex/calculate", headers=auth_headers, json={
            "country": "USA", "weight_kg": 75, "service": "package", "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["chargeable_weight"] == 75.0
        assert d["total"] > 0
        assert d["per_kg_mode"] is True
        assert d["total_per_kg"] is not None

    def test_fedex_envelope_3kg_switches_to_package(self, auth_headers):
        r = requests.post(f"{API}/fedex/calculate", headers=auth_headers, json={
            "country": "USA", "weight_kg": 3, "service": "envelope", "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        notes_joined = " ".join(d["notes"]).lower()
        assert "envelope" in notes_joined and "package" in notes_joined

    def test_fedex_unknown_country(self, auth_headers):
        r = requests.post(f"{API}/fedex/calculate", headers=auth_headers, json={
            "country": "Atlantis", "weight_kg": 1, "service": "package", "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 404

    def test_fedex_requires_auth(self):
        r = requests.post(f"{API}/fedex/calculate", json={
            "country": "USA", "weight_kg": 1, "service": "package", "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code in (401, 403)


# ===== SELF Network =====
class TestSelfCalculate:
    def test_self_au_economy_success(self, auth_headers):
        r = requests.post(f"{API}/self/calculate", headers=auth_headers, json={
            "country_code": "AU",
            "weight_kg": 5,
            "service_code": "AU ECONOMY",
            "postcode": "810",
            "suburb": "Alawa",
            "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["zone"] == "ZONE 3"
        assert d["country"]["code"] == "AU"
        assert d["total"] > 0
        assert d["base_rate"] > 0

    def test_self_sg_food_success(self, auth_headers):
        r = requests.post(f"{API}/self/calculate", headers=auth_headers, json={
            "country_code": "SG",
            "weight_kg": 2,
            "service_code": "FOOD",
            "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["country"]["code"] == "SG"
        assert d["total"] > 0

    def test_self_invalid_postcode(self, auth_headers):
        r = requests.post(f"{API}/self/calculate", headers=auth_headers, json={
            "country_code": "AU",
            "weight_kg": 5,
            "service_code": "AU ECONOMY",
            "postcode": "9999",
            "suburb": "InvalidSuburb",
            "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 400

    def test_self_requires_auth(self):
        r = requests.post(f"{API}/self/calculate", json={
            "country_code": "SG",
            "weight_kg": 2,
            "service_code": "FOOD",
            "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code in (401, 403)


# ===== UPS Saver =====
class TestUpsCalculate:
    def test_ups_usa_5kg_nondoc(self, auth_headers):
        r = requests.post(f"{API}/ups/calculate", headers=auth_headers, json={
            "country_code": "US",
            "weight_kg": 5,
            "shipment_type": "nondocument",
            "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["country"]["code"] == "US"
        assert d["total"] > 0
        assert d["base_rate"] > 0

    def test_ups_requires_auth(self):
        r = requests.post(f"{API}/ups/calculate", json={
            "country_code": "US",
            "weight_kg": 5,
            "shipment_type": "nondocument",
            "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code in (401, 403)


# ===== Calculate Both (4 Carriers) =====
class TestCalculateBoth:
    def test_calc_both_usa(self, auth_headers):
        r = requests.post(f"{API}/calculate-both", headers=auth_headers, json={
            "country_code": "US",
            "weight_kg": 5,
            "shipment_type": "nondocument",
            "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["weight_kg"] == 5
        assert d["customer_name"] == "Test Customer"
        assert d["dhl"] is not None
        assert d["fedex"] is not None
        assert d["self_carrier"] is not None or d["self_error"] is not None
        assert d["ups"] is not None

    def test_calc_both_au_with_postcode(self, auth_headers):
        r = requests.post(f"{API}/calculate-both", headers=auth_headers, json={
            "country_code": "AU",
            "weight_kg": 5,
            "shipment_type": "nondocument",
            "postcode": "810",
            "suburb": "Alawa",
            "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["dhl"] is not None
        assert d["self_carrier"] is not None
        assert d["self_carrier"]["zone"] == "ZONE 3"

    def test_self_us_premium_ground_ny(self, auth_headers):
        r = requests.post(f"{API}/self/calculate", headers=auth_headers, json={
            "country_code": "US",
            "weight_kg": 5,
            "service_code": "PREMIUM GROUND",
            "postcode": "10001",
            "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["zone"] == "USA (CT,DC, NJ, NY, RI)"
        assert d["total"] > 0

    def test_self_us_premium_ground_ca(self, auth_headers):
        r = requests.post(f"{API}/self/calculate", headers=auth_headers, json={
            "country_code": "US",
            "weight_kg": 5,
            "service_code": "PREMIUM GROUND",
            "postcode": "90210",
            "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["zone"] == "USA (AZ,CA, ID, MT, NM, NV, OR, UT, WA)"
        assert d["total"] > 0

    def test_self_gb_express_ni(self, auth_headers):
        r = requests.post(f"{API}/self/calculate", headers=auth_headers, json={
            "country_code": "GB",
            "weight_kg": 5,
            "service_code": "EXPRESS",
            "postcode": "BT1 1AA",
            "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["zone"] == "Northern Ireland(BT1-BT99)"
        assert d["total"] > 0

    def test_self_gb_express_edinburgh(self, auth_headers):
        r = requests.post(f"{API}/self/calculate", headers=auth_headers, json={
            "country_code": "GB",
            "weight_kg": 5,
            "service_code": "EXPRESS",
            "postcode": "EH1 1AA",
            "customer_name": "Test Customer"
        }, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["zone"] == "Edinburgh"
        assert d["total"] > 0


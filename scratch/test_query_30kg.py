import requests
import json
import sys

# Set encoding to utf-8
sys.stdout.reconfigure(encoding='utf-8')

API = "http://localhost:8000/api"

# Login
r = requests.post(f"{API}/auth/login", json={"email": "admin@aeriindia.in", "password": "Aeri@2026"})
token = r.json()["token"]
headers = {"Authorization": f"Bearer {token}"}

# Calculate for US 30kg
payload = {
    "country_code": "US",
    "weight_kg": 30,
    "shipment_type": "nondocument",
    "customer_name": "Test Customer"
}
r = requests.post(f"{API}/ups/calculate", headers=headers, json=payload)
data = r.json()
print("UPS calculation response:")
for k, v in data.items():
    print(f"  {k}: {v}")

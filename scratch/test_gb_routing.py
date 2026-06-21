import os
import sys
# Add backend to path
sys.path.append(os.path.abspath("backend"))

from server import _resolve_gb_express_destination, _resolve_us_premium_zone, _resolve_self_entries

print("Testing GB Express routing:")
print("BT1 1AA ->", _resolve_gb_express_destination("BT1 1AA"))
print("EH1 1AA ->", _resolve_gb_express_destination("EH1 1AA"))
print("G1 1AA ->", _resolve_gb_express_destination("G1 1AA"))
print("SW1A 1AA ->", _resolve_gb_express_destination("SW1A 1AA"))

print("\nTesting US Premium Ground routing:")
print("10001 ->", _resolve_us_premium_zone("10001"))
print("90210 ->", _resolve_us_premium_zone("90210"))

print("\nTesting US entry resolution:")
entries_us = _resolve_self_entries("US")
print(f"US entries count: {len(entries_us)}")
for e in entries_us:
    if "PREMIUM GROUND" in e["service_code"]:
        print(f"  - {e['service_code']} -> {e['destination']}")

import json
from collections import defaultdict

with open("backend/self_rates.json") as f:
    rates = json.load(f)

# Group by dest_code (country code)
by_dest = defaultdict(list)
for r in rates:
    by_dest[r["dest_code"]].append((r["service_code"], r["destination"]))

for code, items in sorted(by_dest.items()):
    print(f"Country {code}:")
    for svc, dest in items:
        print(f"  - Service: {svc} | Destination: {dest}")

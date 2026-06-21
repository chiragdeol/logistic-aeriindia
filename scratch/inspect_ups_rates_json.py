import json

with open("backend/ups_rates.json") as f:
    data = json.load(f)

print("UPS Rates JSON keys:")
print(data.keys())

# Print rate for 5 kg
print("5.0 rate list:")
print(data["rates"].get("5.0") or data["rates"].get("5"))

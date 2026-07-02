import json

with open("backend/fedex_data.json") as f:
    data = json.load(f)

# Find zone index for 'C'
zone_idx = data["zones"].index("C")
print(f"Zone C index: {zone_idx}")

# Get rate for 50.0 kg package
rate_50 = data["package_rates"]["50.0"][zone_idx]
print(f"Base rate for 50.0 kg in Zone C: {rate_50}")

# Let's inspect the math inside server.py for FedEx <= 30 kg vs > 30 kg.
# Wait, for FedEx, does C at 50kg use per-kg mode?
# In server.py:
# weight <= 70.5 kg use standard package rates (so per_kg_mode is False!)
# Wait, let's verify if per_kg_mode is False for 50 kg in FedEx:
# server.py line 747: rounded = _fedex_round_weight(chargeable)
# line 829: if weight <= 70.5 kg (which 50 kg is): per_kg_mode is False!
# So for 50 kg FedEx, per_kg_mode is False.
# Let's calculate using <= 70.5 kg formula:
# base_total = base + demand
# subtotal_1 = base_total + ess_fee
# fuel = subtotal_1 * fuel_pct / 100
# subtotal_2 = subtotal_1 + fuel
# gst = subtotal_2 * gst_pct / 100
# subtotal_3 = subtotal_2 + gst
# local_charge = local_rate * rounded
# total = subtotal_3 + local_charge + margin_amt + clearance

# Let's run a calculation with different fuel surcharge values
# and default settings for FedEx:
# settings.fedex_ess_rate = 94.0
# settings.fedex_fuel_surcharge_pct = 46.5
# settings.fedex_gst_pct = 18.0
# settings.fedex_local_per_kg = 12.0
# settings.fedex_margin = 1500.0 (Wait, or is margin flat 1500?)
# settings.fedex_clearance_charge = 2500.0 (Wait, does clearance apply?)

ess_rate = 94.0
fuel_pct = 46.5
gst_pct = 18.0
local_rate = 12.0
margin_amt = 1500.0
clearance = 2500.0

demand = 85.0 # min 85

print("Trying calculation:")
base_total = rate_50 + demand
ess_fee = ess_rate * 50.0
subtotal_1 = base_total + ess_fee
fuel = subtotal_1 * fuel_pct / 100.0
subtotal_2 = subtotal_1 + fuel
gst = subtotal_2 * gst_pct / 100.0
subtotal_3 = subtotal_2 + gst
local_charge = local_rate * 50.0
total = subtotal_3 + local_charge + margin_amt + clearance
print(f"Total: {total}, Per-kg: {total / 50.0}")

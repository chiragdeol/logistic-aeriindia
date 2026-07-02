def calculate_dhl(base_pk, ess_pk, fuel_pct, gst_pct, local_pk, margin_pk):
    subtotal_1_pk = round(base_pk + ess_pk, 2)
    fuel_pk = round(subtotal_1_pk * fuel_pct / 100.0, 2)
    subtotal_2_pk = round(subtotal_1_pk + fuel_pk, 2)
    gst_pk = round(subtotal_2_pk * gst_pct / 100.0, 2)
    subtotal_3_pk = round(subtotal_2_pk + gst_pk, 2)
    total_pk = round(subtotal_3_pk + local_pk + margin_pk, 2)
    return total_pk

base = 405.6
ess = 30.0
gst = 18.0
local = 12.0
margin = 30.0

print("Trying different fuel surcharges:")
for f in range(4000, 5000):
    fuel_pct = f / 100.0
    res = calculate_dhl(base, ess, fuel_pct, gst, local, margin)
    if round(res) == 780 or int(res) == 780:
        print(f"  Fuel: {fuel_pct}%, Rate: {res}")

def calculate_fedex(base_total, ess_rate, fuel_pct, gst_pct, local_rate, margin_pk):
    base_pk = round(base_total / 50.0, 2)
    ess_fee_pk = round(ess_rate, 2)
    subtotal_1_pk = round(base_pk + ess_fee_pk, 2)
    fuel_pk = round(subtotal_1_pk * fuel_pct / 100.0, 2)
    subtotal_2_pk = round(subtotal_1_pk + fuel_pk, 2)
    gst_pk = round(subtotal_2_pk * gst_pct / 100.0, 2)
    subtotal_3_pk = round(subtotal_2_pk + gst_pk, 2)
    total_pk = round(subtotal_3_pk + local_rate + margin_pk, 2)
    return total_pk

base = 21355.64
ess = 94.0
gst = 18.0
local = 12.0
margin = 30.0

print("Trying different fuel surcharges for FedEx:")
for f in range(3500, 4500):
    fuel_pct = f / 100.0
    res = calculate_fedex(base, ess, fuel_pct, gst, local, margin)
    if round(res) == 895 or int(res) == 895:
        print(f"  Fuel: {fuel_pct}%, Rate: {res}")

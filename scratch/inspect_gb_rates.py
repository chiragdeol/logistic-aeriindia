import json

with open("backend/self_rates.json") as f:
    rates = json.load(f)

gb_related = ["GB", "ED", "GL", "ST", "NIR", "JE/ GG/ CI", "ISM / ISW"]
for r in rates:
    if r["dest_code"] in gb_related:
        print(f"Code: {r['dest_code']} | Service: {r['service_code']} | Dest: {r['destination']} | 0.5kg: {r['rate_0_5']} | 6kg: {r['rate_6']}")

import sys
import os
from pathlib import Path
import json

sys.path.append(str(Path(__file__).parent.parent / "backend"))

with open("backend/ups_rates.json") as f:
    UPS_RATES = json.load(f)
with open("backend/ups_zone_map.json") as f:
    UPS_ZONE_MAP = json.load(f)

# Mock resolve columns
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

col_idx = _resolve_ups_column("United States", "US")
print(f"Col index: {col_idx}")
array_idx = col_idx - 1

for key in ["20+", "30+", "50+"]:
    rates = UPS_RATES["multipliers"].get(key)
    print(f"Key {key}: {rates[array_idx] if rates else 'Not found'}")

import pandas as pd

path = r"c:\Users\Boxinall\Downloads\Logistic-main (1)\Logistic-main\ATLANTIC @ 30.05.2026.xlsx"
df = pd.read_excel(path, sheet_name="Plus GST", header=None)

# Find rows containing 'US' or 'USA'
for i, row in df.iterrows():
    row_str = " | ".join(str(x) for x in row.tolist())
    if "US" in row_str or "USA" in row_str or "Premium" in row_str:
        print(f"Row {i}: {row_str}")

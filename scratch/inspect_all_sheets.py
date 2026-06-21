import pandas as pd

path = r"c:\Users\Boxinall\Downloads\Logistic-main (1)\Logistic-main\ATLANTIC @ 30.05.2026.xlsx"
xl = pd.ExcelFile(path)

print("Sheet Details:")
for sheet in xl.sheet_names:
    df = xl.parse(sheet, nrows=5)
    print(f"Sheet: {sheet}")
    print(f"  Shape: {df.shape}")
    print(f"  Columns: {df.columns.tolist()[:10]}")

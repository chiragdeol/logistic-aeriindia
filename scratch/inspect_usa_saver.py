import pandas as pd
import openpyxl

path = r"c:\Users\Boxinall\Downloads\Logistic-main (1)\Logistic-main\USA SAVER Revised_allin 08-04-26.xlsx"
xl = pd.ExcelFile(path)

print("Sheet Details:")
for sheet in xl.sheet_names:
    print(f"Sheet: {sheet}")
    df = xl.parse(sheet, header=None)
    print(f"Shape: {df.shape}")
    print("First 15 rows:")
    for idx, row in df.head(15).iterrows():
        print(f"Row {idx}: {list(row)}")

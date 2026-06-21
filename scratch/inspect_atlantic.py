import pandas as pd

path = r"c:\Users\Boxinall\Downloads\Logistic-main (1)\Logistic-main\ATLANTIC @ 30.05.2026.xlsx"
xl = pd.ExcelFile(path)

print("Sheet names in ATLANTIC:")
print(xl.sheet_names)

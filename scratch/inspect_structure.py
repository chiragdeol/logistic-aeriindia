import pandas as pd

path = r"c:\Users\Boxinall\Downloads\Logistic-main (1)\Logistic-main\USA SAVER Revised_allin 08-04-26.xlsx"
xl = pd.ExcelFile(path)

for sheet in xl.sheet_names:
    print(f"Sheet: {sheet}")
    df = xl.parse(sheet, header=None)
    print("Col 0 values for first 86 rows:")
    for idx, val in enumerate(df[0]):
        print(f"Row {idx}: {val} (type: {type(val)})")

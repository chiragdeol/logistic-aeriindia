import pandas as pd

path = r"c:\Users\Boxinall\Downloads\Logistic-main (1)\Logistic-main\USA SAVER Revised_allin 08-04-26.xlsx"
xl = pd.ExcelFile(path)

for sheet in xl.sheet_names:
    print("=========================")
    print(f"Sheet: {sheet}")
    df = xl.parse(sheet, header=None)
    
    headers = []
    for r in range(10):
        row = df.iloc[r].tolist()
        if any("USA" in str(x) or "US" == str(x) for x in row):
            headers = row
            break
            
    for idx in range(45, 56):
        if idx < len(df):
            row = df.iloc[idx]
            print(f"Row {idx} (Col 0: {row[0]}):")
            for col_idx, val in enumerate(row):
                col_name = headers[col_idx] if col_idx < len(headers) else f"Col {col_idx}"
                if col_name in ['Country / Zone', 'USA', 'Germany', 'UK', 'ZONE 7', 'ZONE 8', 'ZONE 9']:
                    print(f"  {col_name}: {val}")

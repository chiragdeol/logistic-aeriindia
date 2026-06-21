import openpyxl

path = r"c:\Users\Boxinall\Downloads\Logistic-main (1)\Logistic-main\USA SAVER Revised_allin 08-04-26.xlsx"
wb = openpyxl.load_workbook(path, data_only=True)
sheet = wb["COST_UPS SAVER (Allin)"]

# Let's print row 51 (which is 50 in 0-indexed terms)
row_idx = 51 # Row 50 in pandas, so it is row 51 in openpyxl
print(f"Row {row_idx}:")
for col_idx in range(1, 15):
    cell = sheet.cell(row=row_idx, column=col_idx)
    print(f"Col {col_idx}: value={cell.value}, number_format={cell.number_format}")

/**
 * Row shape for input_json/ArcadeCalculationDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ArcadeCalculation'
 */
export type ArcadeCalculationDataTableRow = {
  ID: string;
  Value: number;
};

/** input_json/ArcadeCalculationDataTable.json — map of row key → row. */
export type ArcadeCalculationDataTableRowsMap = Readonly<Record<string, ArcadeCalculationDataTableRow>>;

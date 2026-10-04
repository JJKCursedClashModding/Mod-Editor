/**
 * Row shape for input_json/PvECalculationDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_PvECalculation'
 */
export type PvECalculationDataTableRow = {
  ID: string;
  Value: number;
};

/** input_json/PvECalculationDataTable.json — map of row key → row. */
export type PvECalculationDataTableRowsMap = Readonly<Record<string, PvECalculationDataTableRow>>;

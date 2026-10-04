/**
 * Row shape for input_json/GlobalThresholdDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_GlobalThreshold'
 */
export type GlobalThresholdDataTableRow = {
  ID: string;
  Max: number;
  Min: number;
};

/** input_json/GlobalThresholdDataTable.json — map of row key → row. */
export type GlobalThresholdDataTableRowsMap = Readonly<Record<string, GlobalThresholdDataTableRow>>;

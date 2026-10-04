/**
 * Row shape for input_json/StampDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Stamp'
 */
export type StampDataTableRow = {
  Filename: string;
  ID: string;
  Id_StampText: string;
  Id_Voice: string;
};

/** input_json/StampDataTable.json — map of row key → row. */
export type StampDataTableRowsMap = Readonly<Record<string, StampDataTableRow>>;

/**
 * Row shape for input_json/ShikigamiUniqueDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ShikigamiUnique'
 */
export type ShikigamiUniqueDataTableRow = {
  FloatValue: readonly number[];
  ID: string;
};

/** input_json/ShikigamiUniqueDataTable.json — map of row key → row. */
export type ShikigamiUniqueDataTableRowsMap = Readonly<Record<string, ShikigamiUniqueDataTableRow>>;

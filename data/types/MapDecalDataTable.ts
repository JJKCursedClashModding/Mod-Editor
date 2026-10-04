/**
 * Row shape for input_json/MapDecalDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_MapDecal'
 */
export type MapDecalDataTableRow = {
  Filename: readonly string[];
  ID: string;
};

/** input_json/MapDecalDataTable.json — map of row key → row. */
export type MapDecalDataTableRowsMap = Readonly<Record<string, MapDecalDataTableRow>>;

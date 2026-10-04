/**
 * Row shape for input_json/MapEffectDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_MapEffect'
 */
export type MapEffectDataTableRow = {
  Filename: readonly string[];
  ID: string;
};

/** input_json/MapEffectDataTable.json — map of row key → row. */
export type MapEffectDataTableRowsMap = Readonly<Record<string, MapEffectDataTableRow>>;

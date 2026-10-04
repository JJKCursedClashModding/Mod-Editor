/**
 * Row shape for input_json/DecalDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Decal'
 */
export type DecalDataTableRow = {
  bResident: boolean;
  Filename: string;
  ID: string;
};

/** input_json/DecalDataTable.json — map of row key → row. */
export type DecalDataTableRowsMap = Readonly<Record<string, DecalDataTableRow>>;

/**
 * Row shape for input_json/ShikigamiMaterialDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ShikigamiMaterial'
 */
export type ShikigamiMaterialDataTableRow = {
  ID: string;
  MaterialName_P1: readonly string[];
  MaterialName_P2: readonly string[];
  MaterialName_P3: readonly string[];
  MaterialName_P4: readonly string[];
  MaterialName_P5: readonly string[];
};

/** input_json/ShikigamiMaterialDataTable.json — map of row key → row. */
export type ShikigamiMaterialDataTableRowsMap = Readonly<Record<string, ShikigamiMaterialDataTableRow>>;

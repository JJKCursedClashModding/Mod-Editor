/**
 * Row shape for input_json/CharacterMaterialDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterMaterial'
 */
export type CharacterMaterialDataTableRow = {
  ID: string;
  MaterialName_P1: readonly string[];
  MaterialName_P2: readonly string[];
  MaterialName_P3: readonly string[];
  MaterialName_P4: readonly string[];
  MaterialName_P5: readonly string[];
  MaterialName_P6: readonly string[];
  MaterialName_P7: readonly string[];
  MaterialName_P8: readonly string[];
};

/** input_json/CharacterMaterialDataTable.json — map of row key → row. */
export type CharacterMaterialDataTableRowsMap = Readonly<Record<string, CharacterMaterialDataTableRow>>;

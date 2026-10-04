/**
 * Row shape for input_json/ScriptCharacterClothesDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ScriptCharacterClothes'
 */
export type ScriptCharacterClothesDataTableRow = {
  ClothesFileName: string;
  FacialFileName: readonly string[];
  ID: string;
};

/** input_json/ScriptCharacterClothesDataTable.json — map of row key → row. */
export type ScriptCharacterClothesDataTableRowsMap = Readonly<Record<string, ScriptCharacterClothesDataTableRow>>;

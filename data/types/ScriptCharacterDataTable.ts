/**
 * Row shape for input_json/ScriptCharacterDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ScriptCharacter'
 */
export type ScriptCharacterDataTableRow = {
  ID: string;
  Id_ScriptCharacterClothes: readonly string[];
};

/** input_json/ScriptCharacterDataTable.json — map of row key → row. */
export type ScriptCharacterDataTableRowsMap = Readonly<Record<string, ScriptCharacterDataTableRow>>;

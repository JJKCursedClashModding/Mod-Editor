/**
 * Row shape for input_json/CharacterShikigamiDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterShikigami'
 */
export type CharacterShikigamiDataTableRow = {
  ID: string;
  Id_Shikigami: readonly string[];
};

/** input_json/CharacterShikigamiDataTable.json — map of row key → row. */
export type CharacterShikigamiDataTableRowsMap = Readonly<Record<string, CharacterShikigamiDataTableRow>>;

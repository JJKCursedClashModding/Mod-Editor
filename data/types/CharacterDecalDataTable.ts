/**
 * Row shape for input_json/CharacterDecalDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterDecal'
 */
export type CharacterDecalDataTableRow = {
  FileName_BP: readonly string[];
  ID: string;
};

/** input_json/CharacterDecalDataTable.json — map of row key → row. */
export type CharacterDecalDataTableRowsMap = Readonly<Record<string, CharacterDecalDataTableRow>>;

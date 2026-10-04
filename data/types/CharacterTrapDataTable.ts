/**
 * Row shape for input_json/CharacterTrapDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterTrap'
 */
export type CharacterTrapDataTableRow = {
  FileName_BP: readonly string[];
  ID: string;
};

/** input_json/CharacterTrapDataTable.json — map of row key → row. */
export type CharacterTrapDataTableRowsMap = Readonly<Record<string, CharacterTrapDataTableRow>>;

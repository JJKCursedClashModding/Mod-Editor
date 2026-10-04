/**
 * Merged row shape for split DataTables: CharacterUniqueDataTable1.json, CharacterUniqueDataTable2.json, CharacterUniqueDataTable3.json, CharacterUniqueDataTable4.json, CharacterUniqueDataTable5.json.
 * Row keys are unique across all parts (same schema).
 * UE row struct: Class'GameDataTableRow_CharacterUnique'
 */
export type CharacterUniqueDataTableRow = {
  FloatValue: readonly number[];
  ID: string;
};

/** Merged CharacterUniqueDataTable1.json, CharacterUniqueDataTable2.json, CharacterUniqueDataTable3.json, CharacterUniqueDataTable4.json, CharacterUniqueDataTable5.json — map of row key → row. */
export type CharacterUniqueDataTableRowsMap = Readonly<Record<string, CharacterUniqueDataTableRow>>;

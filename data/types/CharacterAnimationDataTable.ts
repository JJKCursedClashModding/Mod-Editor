/**
 * Row shape for input_json/CharacterAnimationDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterAnimation'
 */
export type CharacterAnimationDataTableRow = {
  Filename: readonly string[];
  ID: string;
  Key: readonly string[];
};

/** input_json/CharacterAnimationDataTable.json — map of row key → row. */
export type CharacterAnimationDataTableRowsMap = Readonly<Record<string, CharacterAnimationDataTableRow>>;

/**
 * Row shape for input_json/CharacterAnimationSetDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterAnimationSet'
 */
export type CharacterAnimationSetDataTableRow = {
  ID: string;
  Id_CharacterAnimation: readonly string[];
};

/** input_json/CharacterAnimationSetDataTable.json — map of row key → row. */
export type CharacterAnimationSetDataTableRowsMap = Readonly<Record<string, CharacterAnimationSetDataTableRow>>;

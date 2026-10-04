/**
 * Row shape for input_json/CharacterArcadeDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterArcade'
 */
export type CharacterArcadeDataTableRow = {
  ClearFlagConditions: readonly number[];
  ID: string;
  Id_ArcadeMissionSet: readonly string[];
  Id_MissionCharacter: string;
};

/** input_json/CharacterArcadeDataTable.json — map of row key → row. */
export type CharacterArcadeDataTableRowsMap = Readonly<Record<string, CharacterArcadeDataTableRow>>;

/**
 * Row shape for input_json/ShortStoryCharacterDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ShortStoryCharacter'
 */
export type ShortStoryCharacterDataTableRow = {
  ID: string;
  Id_Character: readonly string[];
};

/** input_json/ShortStoryCharacterDataTable.json — map of row key → row. */
export type ShortStoryCharacterDataTableRowsMap = Readonly<Record<string, ShortStoryCharacterDataTableRow>>;

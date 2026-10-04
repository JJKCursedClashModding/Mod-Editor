/**
 * Row shape for input_json/CharacterSelectDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterSelect'
 */
export type CharacterSelectDataTableRow = {
  bUseListItemLeftPadding: boolean;
  ID: string;
  PlacementIndex: number;
  VisualLobbyPlacementIndex: number;
};

/** input_json/CharacterSelectDataTable.json — map of row key → row. */
export type CharacterSelectDataTableRowsMap = Readonly<Record<string, CharacterSelectDataTableRow>>;

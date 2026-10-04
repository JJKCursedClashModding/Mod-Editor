/**
 * Row shape for input_json/CharacterCameraDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterCamera'
 */
export type CharacterCameraDataTableRow = {
  ID: string;
  TargetHeightOffset: number;
};

/** input_json/CharacterCameraDataTable.json — map of row key → row. */
export type CharacterCameraDataTableRowsMap = Readonly<Record<string, CharacterCameraDataTableRow>>;

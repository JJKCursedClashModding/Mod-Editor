/**
 * Row shape for input_json/CharacterCaptureSetDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_CharacterCaptureSet'
 */
export type CharacterCaptureSetDataTableRow = {
  ID: string;
  Id_CharacterCapture: readonly string[];
};

/** input_json/CharacterCaptureSetDataTable.json — map of row key → row. */
export type CharacterCaptureSetDataTableRowsMap = Readonly<Record<string, CharacterCaptureSetDataTableRow>>;

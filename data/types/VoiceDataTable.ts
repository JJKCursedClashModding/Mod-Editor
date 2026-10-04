/**
 * Row shape for input_json/VoiceDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Voice'
 */
export type VoiceDataTableRow = {
  CueName: string;
  CueSheetName: string;
  ID: string;
};

/** input_json/VoiceDataTable.json — map of row key → row. */
export type VoiceDataTableRowsMap = Readonly<Record<string, VoiceDataTableRow>>;

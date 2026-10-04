/**
 * Row shape for input_json/SoundEffectDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_SoundEffect'
 */
export type SoundEffectDataTableRow = {
  CueName: string;
  CueSheetName: string;
  ID: string;
};

/** input_json/SoundEffectDataTable.json — map of row key → row. */
export type SoundEffectDataTableRowsMap = Readonly<Record<string, SoundEffectDataTableRow>>;

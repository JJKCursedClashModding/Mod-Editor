/**
 * Row shape for input_json/BgmDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Bgm'
 */
export type BgmDataTableRow = {
  bInitialReleaseEnabled: boolean;
  CueSheetName: string;
  Duration: number;
  ID: string;
  Id_SoundText: string;
};

/** input_json/BgmDataTable.json — map of row key → row. */
export type BgmDataTableRowsMap = Readonly<Record<string, BgmDataTableRow>>;

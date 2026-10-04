/**
 * Row shape for input_json/ShikigamiAnimationDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ShikigamiAnimation'
 */
export type ShikigamiAnimationDataTableRow = {
  Filename: readonly string[];
  ID: string;
  Key: readonly string[];
};

/** input_json/ShikigamiAnimationDataTable.json — map of row key → row. */
export type ShikigamiAnimationDataTableRowsMap = Readonly<Record<string, ShikigamiAnimationDataTableRow>>;

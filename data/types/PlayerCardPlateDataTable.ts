/**
 * Row shape for input_json/PlayerCardPlateDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_PlayerCardPlate'
 */
export type PlayerCardPlateDataTableRow = {
  ID: string;
  ImageFileName: string;
  ThumbnailImageFileName: string;
};

/** input_json/PlayerCardPlateDataTable.json — map of row key → row. */
export type PlayerCardPlateDataTableRowsMap = Readonly<Record<string, PlayerCardPlateDataTableRow>>;

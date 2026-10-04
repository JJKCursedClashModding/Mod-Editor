/**
 * Row shape for input_json/PlayerCardTitleDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_PlayerCardTitle'
 */
export type PlayerCardTitleDataTableRow = {
  ID: string;
  Id_Item: string;
  Id_ItemText: string;
};

/** input_json/PlayerCardTitleDataTable.json — map of row key → row. */
export type PlayerCardTitleDataTableRowsMap = Readonly<Record<string, PlayerCardTitleDataTableRow>>;

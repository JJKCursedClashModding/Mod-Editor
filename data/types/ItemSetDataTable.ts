/**
 * Row shape for input_json/ItemSetDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ItemSet'
 */
export type ItemSetDataTableRow = {
  ID: string;
  Id_Item: readonly string[];
  Id_ItemText: string;
  Quantity: readonly number[];
};

/** input_json/ItemSetDataTable.json — map of row key → row. */
export type ItemSetDataTableRowsMap = Readonly<Record<string, ItemSetDataTableRow>>;

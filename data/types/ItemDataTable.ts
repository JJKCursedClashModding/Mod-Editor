/**
 * Row shape for input_json/ItemDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_Item'
 */

import type { EGameItemType } from "../enums.js";

export type ItemDataTableRow = {
  ID: string;
  Id_ItemText: string;
  InitialPossession: number;
  ItemType: EGameItemType;
  PossessionMax: number;
  SellPrice: number;
  SortingOrder: number;
  UserProgressFlag: number;
  VariableId: string;
};

/** input_json/ItemDataTable.json — map of row key → row. */
export type ItemDataTableRowsMap = Readonly<Record<string, ItemDataTableRow>>;

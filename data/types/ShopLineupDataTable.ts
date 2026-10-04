/**
 * Row shape for input_json/ShopLineupDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ShopLineup'
 */

import type { EGameItemType, EGameItemUnlockConditionsType } from "../enums.js";

export type ShopLineupDataTableRow = {
  CategoryType: EGameItemType;
  ID: string;
  Id_ItemSet: string;
  Price: number;
  UnlockConditionsType: EGameItemUnlockConditionsType;
  UnlockConditionsValue: readonly number[];
  UnlockConditionsValueStr: readonly string[];
};

/** input_json/ShopLineupDataTable.json — map of row key → row. */
export type ShopLineupDataTableRowsMap = Readonly<Record<string, ShopLineupDataTableRow>>;

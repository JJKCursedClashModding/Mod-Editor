/**
 * Row shape for input_json/ShopLotteryLineupDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ShopLotteryLineup'
 */

import type { EGameShopLotteryRarityType } from "../enums.js";

export type ShopLotteryLineupDataTableRow = {
  ContainsCount: number;
  ID: string;
  Id_ItemSet: string;
  Rariry: EGameShopLotteryRarityType;
  Weight: number;
};

/** input_json/ShopLotteryLineupDataTable.json — map of row key → row. */
export type ShopLotteryLineupDataTableRowsMap = Readonly<Record<string, ShopLotteryLineupDataTableRow>>;

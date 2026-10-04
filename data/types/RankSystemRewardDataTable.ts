/**
 * Row shape for input_json/RankSystemRewardDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_RankSystemReward'
 */

import type { EGameRankSystemRewardType } from "../enums.js";

export type RankSystemRewardDataTableRow = {
  ID: string;
  Id_ItemSet: string;
  RequiredPoint: number;
  RewardType: EGameRankSystemRewardType;
};

/** input_json/RankSystemRewardDataTable.json — map of row key → row. */
export type RankSystemRewardDataTableRowsMap = Readonly<Record<string, RankSystemRewardDataTableRow>>;

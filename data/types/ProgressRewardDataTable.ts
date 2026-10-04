/**
 * Row shape for input_json/ProgressRewardDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ProgressReward'
 */

import type { EGameItemUnlockConditionsType } from "../enums.js";

export type ProgressRewardDataTableRow = {
  ID: string;
  Id_ItemSet: string;
  UnlockConditionsType: EGameItemUnlockConditionsType;
  UnlockConditionsValue: readonly number[];
  UnlockConditionsValueStr: readonly string[];
};

/** input_json/ProgressRewardDataTable.json — map of row key → row. */
export type ProgressRewardDataTableRowsMap = Readonly<Record<string, ProgressRewardDataTableRow>>;

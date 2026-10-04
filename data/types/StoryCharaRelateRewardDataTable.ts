/**
 * Row shape for input_json/StoryCharaRelateRewardDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_StoryCharaRelateReward'
 */
export type StoryCharaRelateRewardDataTableRow = {
  ID: string;
  Id_Character_1: string;
  Id_Character_2: string;
  Id_ItemSet: readonly string[];
};

/** input_json/StoryCharaRelateRewardDataTable.json — map of row key → row. */
export type StoryCharaRelateRewardDataTableRowsMap = Readonly<Record<string, StoryCharaRelateRewardDataTableRow>>;

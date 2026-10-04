/**
 * Row shape for input_json/StoryCharaRelateLevelDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_StoryCharaRelateLevel'
 */
export type StoryCharaRelateLevelDataTableRow = {
  bFriendly: readonly boolean[];
  ID: string;
};

/** input_json/StoryCharaRelateLevelDataTable.json — map of row key → row. */
export type StoryCharaRelateLevelDataTableRowsMap = Readonly<Record<string, StoryCharaRelateLevelDataTableRow>>;

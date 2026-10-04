/**
 * Row shape for input_json/StoryRoomConditionDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_StoryRoomCondition'
 */
export type StoryRoomConditionDataTableRow = {
  ID: string;
  Id_StoryRoomPlacement: readonly string[];
  Weights: readonly number[];
};

/** input_json/StoryRoomConditionDataTable.json — map of row key → row. */
export type StoryRoomConditionDataTableRowsMap = Readonly<Record<string, StoryRoomConditionDataTableRow>>;

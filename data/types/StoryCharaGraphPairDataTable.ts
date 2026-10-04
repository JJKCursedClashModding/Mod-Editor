/**
 * Row shape for input_json/StoryCharaGraphPairDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_StoryCharaGraphPair'
 */
export type StoryCharaGraphPairDataTableRow = {
  EndRelateLevel: readonly number[];
  ID: string;
  Id_Character: readonly string[];
  Id_StoryCharaRelateLevel: readonly string[];
  StartRelateLevel: readonly number[];
};

/** input_json/StoryCharaGraphPairDataTable.json — map of row key → row. */
export type StoryCharaGraphPairDataTableRowsMap = Readonly<Record<string, StoryCharaGraphPairDataTableRow>>;

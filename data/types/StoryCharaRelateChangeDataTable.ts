/**
 * Row shape for input_json/StoryCharaRelateChangeDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_StoryCharaRelateChange'
 */
export type StoryCharaRelateChangeDataTableRow = {
  ChangeValue_1_2: number;
  ChangeValue_2_1: number;
  ID: string;
  Id_Character_1: string;
  Id_Character_2: string;
};

/** input_json/StoryCharaRelateChangeDataTable.json — map of row key → row. */
export type StoryCharaRelateChangeDataTableRowsMap = Readonly<Record<string, StoryCharaRelateChangeDataTableRow>>;

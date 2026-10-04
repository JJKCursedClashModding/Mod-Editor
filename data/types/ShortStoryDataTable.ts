/**
 * Row shape for input_json/ShortStoryDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ShortStory'
 */
export type ShortStoryDataTableRow = {
  ID: string;
  Id_Script: string;
  Id_ShortStory: string;
  Id_ShortStoryCharacter: string;
  Id_StoryText_Title: string;
};

/** input_json/ShortStoryDataTable.json — map of row key → row. */
export type ShortStoryDataTableRowsMap = Readonly<Record<string, ShortStoryDataTableRow>>;

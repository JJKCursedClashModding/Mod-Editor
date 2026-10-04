/**
 * Row shape for input_json/StoryDemoVoiceDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_StoryDemoVoice'
 */
export type StoryDemoVoiceDataTableRow = {
  ID: string;
  Id_Voice: string;
};

/** input_json/StoryDemoVoiceDataTable.json — map of row key → row. */
export type StoryDemoVoiceDataTableRowsMap = Readonly<Record<string, StoryDemoVoiceDataTableRow>>;

/**
 * Row shape for input_json/StoryVoiceOverrideDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_StoryVoiceOverride'
 */
export type StoryVoiceOverrideDataTableRow = {
  ID: string;
  Id_Character: string;
  Id_StoryDemo: string;
  Id_Voice: string;
};

/** input_json/StoryVoiceOverrideDataTable.json — map of row key → row. */
export type StoryVoiceOverrideDataTableRowsMap = Readonly<Record<string, StoryVoiceOverrideDataTableRow>>;

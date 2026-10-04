/**
 * Row shape for input_json/ShortStoryVoiceDataTable.json (DataTable rows).
 * UE row struct: Class'GameDataTableRow_ShortStoryVoice'
 */
export type ShortStoryVoiceDataTableRow = {
  ID: string;
  Id_Voice: string;
};

/** input_json/ShortStoryVoiceDataTable.json — map of row key → row. */
export type ShortStoryVoiceDataTableRowsMap = Readonly<Record<string, ShortStoryVoiceDataTableRow>>;
